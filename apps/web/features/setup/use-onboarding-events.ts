import type { OnboardingEvent } from "@codegenie/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { environmentsKey, onboardingEventsUrl, onboardingKey } from "./api";

// These change what the setup's own record shows (its status, its open question).
const CHANGES_STATUS = new Set(["question_asked", "question_answered", "done"]);

/**
 * Follows one setup's events: the stored ones first, then live. The browser reconnects with
 * Last-Event-ID by itself; the stream is closed once setup is done.
 */
export function useOnboardingEvents(
  projectId: string | undefined,
  onboarding: { id: string; ended: boolean } | undefined,
) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<OnboardingEvent[]>([]);
  const ended = useRef(onboarding?.ended ?? false);
  ended.current = onboarding?.ended ?? false;
  const onboardingId = onboarding?.id;

  useEffect(() => {
    setEvents([]);
    if (!projectId || !onboardingId) return;
    const source = new EventSource(onboardingEventsUrl(projectId), {
      withCredentials: true,
    });
    let lastSeq = 0;
    let done = false;
    const refresh = (keys: unknown[][]) =>
      keys.forEach(
        (queryKey) => void queryClient.invalidateQueries({ queryKey }),
      );

    source.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as OnboardingEvent;
      // Live-only events (no seq) carry nothing the page shows.
      if (event.seq === undefined || event.seq <= lastSeq) return;
      if (event.onboardingId !== onboardingId) return;
      lastSeq = event.seq;
      setEvents((all) => [...all, event]);
      if (lastSeq === 1 || CHANGES_STATUS.has(event.type)) {
        refresh([onboardingKey(projectId)]);
      }
      if (event.type === "done") {
        done = true;
        source.close();
        refresh([["projects"], environmentsKey(projectId)]);
      }
    };
    // The server ends the stream when setup has ended; without a done event (e.g. stopped before
    // it started) the browser would keep reconnecting, so ask whether it's over.
    source.onerror = () => {
      if (done || ended.current) source.close();
      else refresh([onboardingKey(projectId)]);
    };
    return () => source.close();
  }, [projectId, onboardingId, queryClient]);

  return events;
}
