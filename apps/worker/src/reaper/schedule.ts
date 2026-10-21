import type { QueuedWork } from "@codegenie/shared";
import type { Queue } from "bullmq";

const SCHEDULER_ID = "reaper";

export async function scheduleReaper(queue: Queue, intervalMs: number) {
  const data: QueuedWork["reap"] = {};
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { every: intervalMs },
    { name: "reap", data },
  );
  // A worker restarting doesn't trigger the schedule, so lost runs would wait for the next tick.
  await queue.add("reap", data, { deduplication: { id: "reap-at-startup" } });
}
