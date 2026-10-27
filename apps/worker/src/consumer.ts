import {
  ANSWER_CHANNEL,
  CANCEL_CHANNEL,
  WORK_QUEUE,
  type OnboardingAnswerMessage,
  type QueuedWork,
  type QueuedWorkKind,
} from "@hobai/shared";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Log } from "./lib/log.js";
import type { AnswerRouter } from "./onboardings/answer-router.js";

export type Handlers = {
  [K in QueuedWorkKind]: (
    data: QueuedWork[K],
    signal: AbortSignal,
  ) => Promise<unknown>;
};

type QueuedItem = {
  [K in QueuedWorkKind]: { name: K; data: QueuedWork[K] };
}[QueuedWorkKind];

export type ConsumerOptions = {
  /** Needs `maxRetriesPerRequest: null`, as BullMQ requires. */
  connection: Redis;
  /** A connection of its own: a subscribed connection can't run other commands. */
  subscriber: Redis;
  handlers: Handlers;
  /** Where answers to a setup's questions go. */
  answers: AnswerRouter;
  concurrency: number;
  log: Log;
  prefix?: string;
};

export type Consumer = {
  /** Stops taking new work and waits for the work in progress. */
  close(): Promise<void>;
};

export async function startConsumer(
  options: ConsumerOptions,
): Promise<Consumer> {
  const { handlers, log } = options;
  // Runs and setups in progress, by their id, so Stop can reach either.
  const inProgress = new Map<string, AbortController>();

  const onMessage = (channel: string, message: string) => {
    if (channel === CANCEL_CHANNEL) {
      const work = inProgress.get(message);
      if (!work) return;
      log("info", "Stopping work", { id: message });
      work.abort();
    } else if (channel === ANSWER_CHANNEL) {
      try {
        options.answers.deliver(JSON.parse(message) as OnboardingAnswerMessage);
      } catch (error) {
        log("warn", "Ignored an answer that couldn't be read", {
          error: String(error),
        });
      }
    }
  };
  options.subscriber.on("message", onMessage);
  await options.subscriber.subscribe(CANCEL_CHANNEL, ANSWER_CHANNEL);

  const handle = async (job: Job) => {
    const item = { name: job.name, data: job.data } as QueuedItem;
    const controller = new AbortController();
    const started = Date.now();
    log("info", "Work started", { kind: job.name, id: job.id, ...item.data });
    switch (item.name) {
      case "run-task":
        inProgress.set(item.data.runId, controller);
        try {
          await handlers["run-task"](item.data, controller.signal);
        } finally {
          inProgress.delete(item.data.runId);
        }
        break;
      case "onboard-project":
        inProgress.set(item.data.onboardingId, controller);
        try {
          await handlers["onboard-project"](item.data, controller.signal);
        } finally {
          inProgress.delete(item.data.onboardingId);
        }
        break;
      case "reap":
        await handlers.reap(item.data, controller.signal);
        break;
      default:
        throw new Error(`Unknown work kind "${job.name}".`);
    }
    log("info", "Work finished", {
      kind: job.name,
      id: job.id,
      durationMs: Date.now() - started,
    });
  };

  const worker = new Worker(WORK_QUEUE, handle, {
    connection: options.connection,
    prefix: options.prefix,
    concurrency: options.concurrency,
    // A run whose worker died isn't retried; the reaper ends it.
    maxStalledCount: 0,
    // How long the lock outlives the last renewal: a short Redis outage mustn't look like a dead worker,
    // whose runs the reaper would end while they're still going.
    lockDuration: 2 * 60_000,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  });
  worker.on("failed", (job, error) =>
    log("error", "Work failed", {
      kind: job?.name,
      id: job?.id,
      error: error.message,
    }),
  );
  worker.on("error", (error) =>
    log("error", "Queue error", { error: error.message }),
  );
  await worker.waitUntilReady();

  return {
    async close() {
      await worker.close();
      options.subscriber.off("message", onMessage);
      await options.subscriber.unsubscribe(CANCEL_CHANNEL, ANSWER_CHANNEL);
    },
  };
}
