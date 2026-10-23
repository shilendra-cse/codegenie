
export const WORK_QUEUE = "codegenie-work";

export const DEFAULT_AGENT_MODEL = "openai:gpt-6-luna";

export type QueuedWork = {
  "run-task": { runId: string };
  "onboard-project": { onboardingId: string };
  reap: Record<string, never>;
};

export type QueuedWorkKind = keyof QueuedWork;

export const CANCEL_CHANNEL = "run-cancel";

export function runChannel(runId: string): string {
  return `run:${runId}`;
}

export function onboardingChannel(onboardingId: string): string {
  return `onboarding:${onboardingId}`;
}
