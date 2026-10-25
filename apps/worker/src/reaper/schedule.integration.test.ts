import { WORK_QUEUE } from "@hobai/shared";
import { Queue } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import { testRedisOrSkip } from "../testing/test-redis.js";
import { scheduleReaper } from "./schedule.js";

const redis = await testRedisOrSkip("reaper schedule");

describe.skipIf(!redis)("reaper schedule against Redis", () => {
  const { prefix, connect } = redis!;
  const queue = new Queue(WORK_QUEUE, { connection: connect(), prefix });
  afterAll(async () => {
    await queue.close();
    await redis?.close();
  });

  it("keeps one schedule and one startup reap however many workers start", async () => {
    await scheduleReaper(queue, 5 * 60_000);
    await scheduleReaper(queue, 5 * 60_000);

    expect(await queue.getJobSchedulersCount()).toBe(1);
    expect(await queue.getJobSchedulers()).toMatchObject([
      { key: "reaper", every: 5 * 60_000, name: "reap" },
    ]);
    const waiting = await queue.getWaiting();
    expect(waiting.map((job) => job.name)).toEqual(["reap", "reap"]);
    expect(waiting.filter((job) => !job.repeatJobKey)).toHaveLength(1);
  });
});
