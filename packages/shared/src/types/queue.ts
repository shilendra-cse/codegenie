export const JOB_QUEUE = "codegenie-jobs";

export type QueuedWork = {
  "run-job": { jobId: string };
  "onboard-project": { projectId: string };
};

export type QueuedWorkKind = keyof QueuedWork;

export const CANCEL_CHANNEL = "job-cancel";

export function onboardingChannel(projectId: string): string {
  return `project:${projectId}:onboarding`;
}
