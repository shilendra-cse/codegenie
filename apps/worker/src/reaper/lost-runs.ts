import {
  getLastRunEventSeq,
  listUnfinishedRuns,
  markRunEnded,
  type Db,
} from "@codegenie/db";
import type { Queue } from "bullmq";
import { createEventSink, type Publisher } from "../events/sink.js";
import type { Log } from "../lib/log.js";

/** Long enough for the moment between inserting a run and queueing it, and for a short Redis outage. */
export const QUEUED_GRACE_MS = 15 * 60_000;

const PENDING = new Set([
  "waiting",
  "delayed",
  "prioritized",
  "waiting-children",
  "active",
]);

const REASONS = {
  worker_lost: "The worker running it stopped before the run finished.",
  lost_in_queue: "It was queued but never started, and its queue item is gone.",
};

export type LostRun = {
  runId: string;
  status: "queued" | "running";
  code: keyof typeof REASONS;
};

export type LostRunsDeps = {
  db: Db;
  queue: Pick<Queue, "getJobState">;
  publisher: Publisher;
  log: Log;
};

// A run's queue item has the run's id, and only stays active while a live worker holds its lock.
export async function findLostRuns(
  db: Db,
  queue: LostRunsDeps["queue"],
  now = Date.now(),
): Promise<LostRun[]> {
  const lost: LostRun[] = [];
  for (const run of await listUnfinishedRuns(db)) {
    const state = await queue.getJobState(run.id);
    if (run.status === "running" && state !== "active") {
      lost.push({ runId: run.id, status: "running", code: "worker_lost" });
    } else if (
      run.status === "queued" &&
      !PENDING.has(state) &&
      now - run.queuedAt.getTime() > QUEUED_GRACE_MS
    ) {
      lost.push({ runId: run.id, status: "queued", code: "lost_in_queue" });
    }
  }
  return lost;
}

/** Fails runs nothing will ever finish, so anyone watching sees them end and their task is free again. */
export async function failLostRuns(deps: LostRunsDeps): Promise<LostRun[]> {
  const failed: LostRun[] = [];
  for (const lost of await findLostRuns(deps.db, deps.queue)) {
    const { runId, code } = lost;
    const message = REASONS[code];
    const ended = await markRunEnded(
      deps.db,
      runId,
      { status: "failed", errorCode: code, errorMessage: message },
      [lost.status],
    );
    if (!ended) continue;

    const sink = createEventSink(
      deps,
      runId,
      await getLastRunEventSeq(deps.db, runId),
    );
    const ts = new Date().toISOString();
    sink.emit({ type: "error", runId, ts, code, message });
    sink.emit({ type: "done", runId, ts, status: "failed" });
    try {
      await sink.flush();
    } catch (error) {
      deps.log("warn", "A lost run's events weren't saved or published", {
        runId,
        error: String(error),
      });
    }
    deps.log("warn", "Failed a lost run", { runId, code });
    failed.push(lost);
  }
  return failed;
}
