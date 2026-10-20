import { runEvents, type Db } from "@codegenie/db";
import { runChannel, type RunEvent } from "@codegenie/shared";
import { createSerialQueue } from "../lib/serial-queue.js";

export type Publisher = {
  publish(channel: string, message: string): Promise<unknown>;
};

const LIVE_ONLY: ReadonlySet<RunEvent["type"]> = new Set([
  "text_delta",
  "agent_step",
]);

export type EventSink = {
  emit(event: RunEvent): void;
  /** Waits for every event so far; rejects with the first write that failed. */
  flush(): Promise<void>;
};

// The worker is a run's only writer, so it can number the events itself.
export function createEventSink(
  deps: { db: Db; publisher: Publisher },
  runId: string,
): EventSink {
  let seq = 0;
  const writes = createSerialQueue();

  const write = async (event: RunEvent) => {
    const { type, runId: _runId, ts, seq: _seq, ...payload } = event;
    if (LIVE_ONLY.has(type)) {
      await deps.publisher.publish(runChannel(runId), JSON.stringify(event));
      return;
    }
    const numbered = { ...event, seq: seq + 1 };
    await deps.db.insert(runEvents).values({
      runId,
      seq: numbered.seq,
      type,
      payload,
      createdAt: new Date(ts),
    });
    seq = numbered.seq;
    await deps.publisher.publish(runChannel(runId), JSON.stringify(numbered));
  };

  return {
    emit: (event) => writes.add(() => write(event)),
    flush: () => writes.drain(),
  };
}
