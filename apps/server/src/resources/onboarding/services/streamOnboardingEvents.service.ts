import { type Db, findOnboarding, findOnboardingEventsAfter } from "@hobai/db";
import { onboardingChannel, type OnboardingEvent } from "@hobai/shared";
import { type EventStreamDeps, streamEvents } from "@/lib/event-stream";
import type { SseStream } from "@/lib/sse";
import { getUserOnboarding } from "./getUserOnboarding.service";

export type StreamOnboardingEventsDeps = { db: Db } & EventStreamDeps;

const ENDED = new Set(["succeeded", "failed", "cancelled"]);

type StoredEvent = Awaited<
  ReturnType<typeof findOnboardingEventsAfter>
>[number];

function toOnboardingEvent(row: StoredEvent): OnboardingEvent {
  return {
    ...row.payload,
    type: row.type,
    onboardingId: row.onboardingId,
    ts: row.createdAt.toISOString(),
    seq: row.seq,
  } as OnboardingEvent;
}

/** The events of the project's latest setup: what's stored, then live until it ends. */
export async function streamOnboardingEvents(
  deps: StreamOnboardingEventsDeps,
  options: {
    userId: string;
    projectId: string;
    afterSeq: number;
    open: () => SseStream;
  },
): Promise<void> {
  const { db } = deps;
  const { id } = await getUserOnboarding(db, options.userId, options.projectId);
  await streamEvents(
    deps,
    {
      channel: onboardingChannel(id),
      eventsAfter: async (seq, limit) =>
        (await findOnboardingEventsAfter(db, id, seq, limit)).map((row) => ({
          seq: row.seq,
          event: toOnboardingEvent(row),
        })),
      // A setup cancelled before it started has no events at all, so its status is what ends the stream.
      hasEnded: async () => {
        const onboarding = await findOnboarding(db, id);
        return !onboarding || ENDED.has(onboarding.status);
      },
    },
    { afterSeq: options.afterSeq, open: options.open },
  );
}
