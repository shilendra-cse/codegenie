import type { EventHub } from "./event-hub";
import type { SseStream } from "./sse";

type StreamedEvent = { type: string; seq?: number };

/** What differs between a run's events and a setup's. */
export type EventSource<E extends StreamedEvent> = {
  channel: string;
  /** Stored events after `seq`, oldest first. */
  eventsAfter(seq: number, limit: number): Promise<{ seq: number; event: E }[]>;
  /** True once it has ended; also when it's gone. */
  hasEnded(): Promise<boolean>;
};

export type EventStreamDeps = {
  hub: Pick<EventHub, "listen">;
  heartbeatMs: number;
};

const PAGE_SIZE = 500;

function parse<E>(message: string): E | null {
  try {
    return JSON.parse(message) as E;
  } catch {
    return null;
  }
}

/**
 * Listens first, then replays what's stored, then forwards what arrived meanwhile and everything live,
 * so nothing falls between the replay and the live events. Ends on `done`, or once it has ended.
 */
export async function streamEvents<E extends StreamedEvent>(
  deps: EventStreamDeps,
  source: EventSource<E>,
  options: { afterSeq: number; open: () => SseStream },
): Promise<void> {
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

  const sendStored = (event: E, seq: number) => {
    send({ id: seq, data: JSON.stringify(event) });
    lastSeq = seq;
    if (event.type === "done") finish();
  };

  const replay = async () => {
    for (;;) {
      const page = await source.eventsAfter(lastSeq, PAGE_SIZE);
      for (const { seq, event } of page) sendStored(event, seq);
      if (page.length < PAGE_SIZE) return;
    }
  };

  const forward = async (message: string) => {
    const event = parse<E>(message);
    if (!event) return;
    if (event.seq === undefined) {
      send({ data: message });
      return;
    }
    if (event.seq > lastSeq + 1) await replay();
    if (event.seq > lastSeq) sendStored(event, event.seq);
  };

  const endIfEnded = async () => {
    if (!(await source.hasEnded())) return;
    await replay();
    finish();
  };

  const receive = (message: string) => {
    if (live) later(() => forward(message));
    else buffered.push(message);
  };

  const stopListening = await deps.hub.listen(source.channel, receive);
  const heartbeat = setInterval(() => {
    send({ comment: "ping" });
    later(endIfEnded);
  }, deps.heartbeatMs);

  try {
    await replay();
    live = true;
    buffered.splice(0).forEach(receive);
    later(endIfEnded);
    await finished;
  } finally {
    clearInterval(heartbeat);
    await stopListening();
  }
  if (failure) throw failure;
}
