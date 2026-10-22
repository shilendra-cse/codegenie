import { type Db, findRunEventsAfter, findUserRun } from "@codegenie/db";
import type { RunEvent } from "@codegenie/shared";
import type { RunEventHub } from "@/lib/run-event-hub";
import type { SseStream } from "@/lib/sse";
import { getUserRun } from "./getUserRun.service";

export type StreamRunEventsDeps = {
  db: Db;
  hub: Pick<RunEventHub, "listen">;
  heartbeatMs: number;
};

export type StreamRunEventsOptions = {
  userId: string;
  runId: string;
  afterSeq: number;
  open: () => SseStream;
};

const PAGE_SIZE = 500;
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

function parse(message: string): RunEvent | null {
  try {
    return JSON.parse(message) as RunEvent;
  } catch {
    return null;
  }
}

export async function streamRunEvents(
  deps: StreamRunEventsDeps,
  options: StreamRunEventsOptions,
): Promise<void> {
  const { db } = deps;
  const { userId, runId } = options;
  await getUserRun(db, userId, runId);
  const { send, signal } = options.open();
  let lastSeq = options.afterSeq;
  let live = false;
  const buffered: string[] = [];
  let work = Promise.resolve();
  let failure: Error | undefined;

  let finish = () => {};
  const finished = new Promise<void>((resolve) => (finish = resolve));
  signal.addEventListener("abort", () => finish(), { once: true });

  const later = (step: () => Promise<void>) => {
    work = work.then(step).catch((error: unknown) => {
      failure ??= error instanceof Error ? error : new Error(String(error));
      finish();
    });
  };

  const sendStored = (event: RunEvent, seq: number) => {
    send({ id: seq, data: JSON.stringify(event) });
    lastSeq = seq;
    if (event.type === "done") finish();
  };

  const replay = async () => {
    for (;;) {
      const page = await findRunEventsAfter(db, runId, lastSeq, PAGE_SIZE);
      for (const row of page) sendStored(toRunEvent(row), row.seq);
      if (page.length < PAGE_SIZE) return;
    }
  };

  const forward = async (message: string) => {
    const event = parse(message);
    if (!event) return;
    if (event.seq === undefined) {
      send({ data: message });
      return;
    }
    if (event.seq > lastSeq + 1) await replay();
    if (event.seq > lastSeq) sendStored(event, event.seq);
  };

  const endIfRunEnded = async () => {
    const run = await findUserRun(db, userId, runId);
    if (run && !ENDED.has(run.status)) return;
    await replay();
    finish();
  };

  const receive = (message: string) => {
    if (live) later(() => forward(message));
    else buffered.push(message);
  };

  const stopListening = await deps.hub.listen(runId, receive);
  const heartbeat = setInterval(() => {
    send({ comment: "ping" });
    later(endIfRunEnded);
  }, deps.heartbeatMs);

  try {
    await replay();
    live = true;
    buffered.splice(0).forEach(receive);
    later(endIfRunEnded);
    await finished;
  } finally {
    clearInterval(heartbeat);
    await stopListening();
  }
  if (failure) throw failure;
}
