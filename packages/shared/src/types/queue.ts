export const WORK_QUEUE = "codegenie-work";

export type QueuedWork = {
  "run-task": { runId: string };
  "onboard-project": { projectId: string };
};

export type QueuedWorkKind = keyof QueuedWork;

export const CANCEL_CHANNEL = "run-cancel";

export function onboardingChannel(projectId: string): string {
  return `project:${projectId}:onboarding`;
}
