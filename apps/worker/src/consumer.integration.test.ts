import { CANCEL_CHANNEL, WORK_QUEUE } from "@codegenie/shared";
import { Queue, QueueEvents, type Job } from "bullmq";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { startConsumer, type Consumer, type Handlers } from "./consumer.js";
import { testRedisOrSkip } from "./testing/test-redis.js";

const redis = await testRedisOrSkip("consumer");

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const idle: Handlers = {
  "run-task": async () => {},
  "onboard-project": async () => {},
};

describe.skipIf(!redis)("consumer against Redis", () => {
  const { prefix, connect } = redis!;
  const queue = new Queue(WORK_QUEUE, { connection: connect(), prefix });
  const events = new QueueEvents(WORK_QUEUE, {
    connection: connect(),
    prefix,
  });
  const consumers: Consumer[] = [];
  const logs: { level: string; message: string }[] = [];

  afterEach(async () => {
    await Promise.all(consumers.splice(0).map((c) => c.close()));
    logs.length = 0;
  });
  afterAll(async () => {
    await queue.close();
    await events.close();
    await redis?.close();
  });

  async function start(handlers: Partial<Handlers>) {
    const consumer = await startConsumer({
      connection: connect(),
      subscriber: connect(),
      handlers: { ...idle, ...handlers },
      concurrency: 2,
      log: (level, message) => logs.push({ level, message }),
      prefix,
    });
    consumers.push(consumer);
    return consumer;
  }

  const finished = (job: Job) => job.waitUntilFinished(events);

  it("hands each kind of work to its handler", async () => {
    const received: unknown[] = [];
    await start({
      "run-task": async (data) => void received.push(data),
      "onboard-project": async (data) => void received.push(data),
    });

    await finished(await queue.add("run-task", { runId: "run-1" }));
    await finished(await queue.add("onboard-project", { projectId: "p-1" }));

    expect(received).toEqual([{ runId: "run-1" }, { projectId: "p-1" }]);
  });

  it("fails work of an unknown kind and keeps going", async () => {
    await start({});

    await expect(finished(await queue.add("paint-house", {}))).rejects.toThrow(
      'Unknown work kind "paint-house".',
    );
    await finished(await queue.add("run-task", { runId: "run-2" }));
  });

  it("fails work whose handler throws, logs it and keeps going", async () => {
    await start({
      "run-task": async ({ runId }) => {
        if (runId === "bad") throw new Error("sandbox exploded");
      },
    });

    await expect(
      finished(await queue.add("run-task", { runId: "bad" })),
    ).rejects.toThrow("sandbox exploded");
    await finished(await queue.add("run-task", { runId: "good" }));
    expect(logs).toContainEqual({ level: "error", message: "Work failed" });
  });

  it("aborts only the run named in a cancel message", async () => {
    const signals = new Map<string, AbortSignal>();
    const bothStarted = { a: deferred(), b: deferred() };
    const releaseB = deferred();
    await start({
      "run-task": async ({ runId }, signal) => {
        signals.set(runId, signal);
        if (runId === "run-a") {
          bothStarted.a.resolve();
          await new Promise((r) => signal.addEventListener("abort", r));
        } else {
          bothStarted.b.resolve();
          await releaseB.promise;
        }
      },
    });

    const a = await queue.add("run-task", { runId: "run-a" });
    const b = await queue.add("run-task", { runId: "run-b" });
    await Promise.all([bothStarted.a.promise, bothStarted.b.promise]);
    await connect().publish(CANCEL_CHANNEL, "run-a");
    await finished(a);

    expect(signals.get("run-a")?.aborted).toBe(true);
    expect(signals.get("run-b")?.aborted).toBe(false);
    releaseB.resolve();
    await finished(b);
  });

  it("waits for work in progress when closing", async () => {
    const started = deferred();
    const release = deferred();
    const consumer = await start({
      "run-task": async () => {
        started.resolve();
        await release.promise;
      },
    });
    const job = await queue.add("run-task", { runId: "run-3" });
    await started.promise;

    let closed = false;
    const closing = consumer.close().then(() => (closed = true));
    await new Promise((r) => setTimeout(r, 200));
    expect(closed).toBe(false);

    release.resolve();
    await closing;
    await finished(job);
    consumers.splice(consumers.indexOf(consumer), 1);
  });
});
