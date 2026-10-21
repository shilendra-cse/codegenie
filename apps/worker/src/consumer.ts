import {
  CANCEL_CHANNEL,
  WORK_QUEUE,
  type QueuedWork,
  type QueuedWorkKind,
} from "@codegenie/shared";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Log } from "./lib/log.js";

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
  const runs = new Map<string, AbortController>();

  const cancel = (channel: string, runId: string) => {
    if (channel !== CANCEL_CHANNEL) return;
    const run = runs.get(runId);
    if (!run) return;
    log("info", "Cancelling run", { runId });
    run.abort();
  };
  options.subscriber.on("message", cancel);
  await options.subscriber.subscribe(CANCEL_CHANNEL);

  const handle = async (job: Job) => {
    const item = { name: job.name, data: job.data } as QueuedItem;
    const controller = new AbortController();
    const started = Date.now();
    log("info", "Work started", { kind: job.name, id: job.id, ...item.data });
    switch (item.name) {
      case "run-task":
        runs.set(item.data.runId, controller);
        try {
          await handlers["run-task"](item.data, controller.signal);
        } finally {
          runs.delete(item.data.runId);
        }
        break;
      case "onboard-project":
        await handlers["onboard-project"](item.data, controller.signal);
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
      options.subscriber.off("message", cancel);
      await options.subscriber.unsubscribe(CANCEL_CHANNEL);
    },
  };
}
