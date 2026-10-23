
export const WORK_QUEUE = "codegenie-work";

export const DEFAULT_AGENT_MODEL = "openai:gpt-6-luna";

export type QueuedWork = {
  "run-task": { runId: string };
  "onboard-project": { onboardingId: string };
  reap: Record<string, never>;
};

export type QueuedWorkKind = keyof QueuedWork;

/** Stops a run or a setup; the message is its id. */
export const CANCEL_CHANNEL = "run-cancel";

/** Brings an answer from the API to the worker holding the setup. */
export const ANSWER_CHANNEL = "onboarding-answer";

export function runChannel(runId: string): string {
  return `run:${runId}`;
}

export function onboardingChannel(onboardingId: string): string {
  return `onboarding:${onboardingId}`;
}
