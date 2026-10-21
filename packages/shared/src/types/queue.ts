import type { RunEvent } from "./api.js";
import type { OnboardingStatus } from "./environment.js";

export const WORK_QUEUE = "codegenie-work";

export type QueuedWork = {
  "run-task": { runId: string };
  "onboard-project": { projectId: string };
  reap: Record<string, never>;
};

export type QueuedWorkKind = keyof QueuedWork;

export const CANCEL_CHANNEL = "run-cancel";

export function onboardingChannel(projectId: string): string {
  return `project:${projectId}:onboarding`;
}

export type OnboardingMessage =
  | { type: "info"; message: string }
  | { type: "event"; event: RunEvent }
  | {
      type: "done";
      status: OnboardingStatus;
      version?: number;
      error?: string;
    };
