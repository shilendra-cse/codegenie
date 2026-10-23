import { type Db, findRunEventsAfter, findUserRun } from "@codegenie/db";
import { runChannel, type RunEvent } from "@codegenie/shared";
import { type EventStreamDeps, streamEvents } from "@/lib/event-stream";
import type { SseStream } from "@/lib/sse";
import { getUserRun } from "./getUserRun.service";

export type StreamRunEventsDeps = { db: Db } & EventStreamDeps;

export type StreamRunEventsOptions = {
  userId: string;
  runId: string;
  afterSeq: number;
  open: () => SseStream;
};

const ENDED = new Set(["succeeded", "incomplete", "failed", "cancelled"]);

type StoredEvent = Awaited<ReturnType<typeof findRunEventsAfter>>[number];

function toRunEvent(row: StoredEvent): RunEvent {
  return {
    ...row.payload,
    type: row.type,
    runId: row.runId,
    ts: row.createdAt.toISOString(),
    seq: row.seq,
  } as RunEvent;
}

export async function streamRunEvents(
  deps: StreamRunEventsDeps,
  { userId, runId, afterSeq, open }: StreamRunEventsOptions,
): Promise<void> {
  const { db } = deps;
  await getUserRun(db, userId, runId);
  await streamEvents(
    deps,
    {
      channel: runChannel(runId),
      eventsAfter: async (seq, limit) =>
        (await findRunEventsAfter(db, runId, seq, limit)).map((row) => ({
          seq: row.seq,
          event: toRunEvent(row),
        })),
      hasEnded: async () => {
        const run = await findUserRun(db, userId, runId);
        return !run || ENDED.has(run.status);
      },
    },
    { afterSeq, open },
  );
}
