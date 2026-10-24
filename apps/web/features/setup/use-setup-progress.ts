import { buildTimeline } from "./timeline";
import { isSetupActive, useOnboarding } from "./use-onboarding";
import { useOnboardingEvents } from "./use-onboarding-events";

/** A project's latest setup, followed live, with its timeline. */
export function useSetupProgress(projectId: string | undefined) {
  const latest = useOnboarding(projectId);
  const onboarding = latest.data;
  const active = isSetupActive(onboarding);
  const events = useOnboardingEvents(
    projectId,
    onboarding ? { id: onboarding.id, ended: !active } : undefined,
  );
  return { latest, onboarding, active, timeline: buildTimeline(events) };
}
