import { insertOnboardingEvent, insertRunEvent, type Db } from "@hobai/db";
import {
  onboardingChannel,
  runChannel,
  type OnboardingEventBody,
  type RunEvent,
} from "@hobai/shared";
import { redactGithubTokensIn } from "../lib/redact.js";
import { createSerialQueue } from "../lib/serial-queue.js";

export type Publisher = {
  publish(channel: string, message: string): Promise<unknown>;
};

const LIVE_ONLY: ReadonlySet<string> = new Set(["text_delta", "agent_step"]);

type StoredRow = {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/** Where one run's or one setup's events are stored and published. */
export type EventTarget = {
  channel: string;
  /** How the event names what it belongs to, e.g. `{ runId }`. */
  owner: Record<string, string>;
  insert(row: StoredRow): Promise<void>;
};

export const runEventTarget = (db: Db, runId: string): EventTarget => ({
  channel: runChannel(runId),
  owner: { runId },
  insert: (row) => insertRunEvent(db, { runId, ...row }),
});

export const onboardingEventTarget = (
  db: Db,
  onboardingId: string,
): EventTarget => ({
  channel: onboardingChannel(onboardingId),
  owner: { onboardingId },
  insert: (row) => insertOnboardingEvent(db, { onboardingId, ...row }),
});

/** Anything with a type and a time; the runner's events carry their run's id, which is replaced by the target's. */
type SinkEvent = (RunEvent | OnboardingEventBody) & { runId?: string };

export type EventSink<E extends SinkEvent = RunEvent> = {
  emit(event: E): void;
  /** Waits for every event so far; rejects with the first write that failed. */
  flush(): Promise<void>;
};

// The worker is the only writer of a run's or a setup's events, so it can number them itself.
export function createEventSink<E extends SinkEvent = RunEvent>(
  deps: { publisher: Publisher },
  target: EventTarget,
  /** The last event number already stored, when adding to existing events. */
  lastSeq = 0,
): EventSink<E> {
  let seq = lastSeq;
  const writes = createSerialQueue();

  const write = async (unredacted: E) => {
    const event = redactGithubTokensIn(unredacted);
    const {
      type,
      ts,
      runId: _runId,
      seq: _seq,
      ...payload
    } = event as E & {
      seq?: number;
    };
    const message = { type, ts, ...payload, ...target.owner };
    if (LIVE_ONLY.has(type)) {
      await deps.publisher.publish(target.channel, JSON.stringify(message));
      return;
    }
    await target.insert({
      seq: seq + 1,
      type,
      payload,
      createdAt: new Date(ts),
    });
    seq += 1;
    await deps.publisher.publish(
      target.channel,
      JSON.stringify({ ...message, seq }),
    );
  };

  return {
    emit: (event) => writes.add(() => write(event)),
    flush: () => writes.drain(),
  };
}
