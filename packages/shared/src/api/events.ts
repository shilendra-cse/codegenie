import type { CheckStatus, StepStatus } from "../types/environment.js";
import type { FinalRunStatus, RunStage } from "./runs.js";

export type RunEventBase = {
  runId: string;
  /** Absent for events that are streamed but not persisted (text_delta). */
  seq?: number;
  ts: string;
};

export type RunEventStageChanged = RunEventBase & {
  type: "stage_changed";
  stage: RunStage;
};

export type RunEventSandboxCreated = RunEventBase & {
  type: "sandbox_created";
  sandboxId: string;
};

export type RunEventSetupStarted = RunEventBase & {
  type: "setup_started";
};

export type RunEventSetupCompleted = RunEventBase & {
  type: "setup_completed";
  success: boolean;
  steps: { name: string; cwd: string; status: StepStatus }[];
  checks: { name: string; cwd: string; status?: CheckStatus }[];
};

export type RunEventToolStart = RunEventBase & {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type RunEventToolEnd = RunEventBase & {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

/** After each model step: progress of the agent run so far. Streamed, not persisted. */
export type RunEventAgentStep = RunEventBase & {
  type: "agent_step";
  steps: number;
  costUsd: number;
};

export type RunEventTextDelta = RunEventBase & {
  type: "text_delta";
  delta: string;
};

export type RunEventBranchCreated = RunEventBase & {
  type: "branch_created";
  branchName: string;
};

export type RunEventLintCompleted = RunEventBase & {
  type: "lint_completed";
  success: boolean;
};

export type RunEventTestStarted = RunEventBase & {
  type: "test_started";
};

export type RunEventTestPassed = RunEventBase & {
  type: "test_passed";
};

export type RunEventTestFailed = RunEventBase & {
  type: "test_failed";
  message?: string;
};

export type RunEventBuildCompleted = RunEventBase & {
  type: "build_completed";
  success: boolean;
};

export type RunEventGitPush = RunEventBase & {
  type: "git_push";
  branchName: string;
  sha: string;
};

export type RunEventPrOpened = RunEventBase & {
  type: "pr_opened";
  prNumber: number;
  prUrl: string;
  draft: boolean;
};

export type RunEventPreviewReady = RunEventBase & {
  type: "preview_ready";
  url: string;
};

export type RunEventError = RunEventBase & {
  type: "error";
  code?: string;
  message: string;
};

export type RunEventDone = RunEventBase & {
  type: "done";
  status: FinalRunStatus;
};

export type RunEvent =
  | RunEventStageChanged
  | RunEventSandboxCreated
  | RunEventSetupStarted
  | RunEventSetupCompleted
  | RunEventToolStart
  | RunEventToolEnd
  | RunEventTextDelta
  | RunEventAgentStep
  | RunEventBranchCreated
  | RunEventLintCompleted
  | RunEventTestStarted
  | RunEventTestPassed
  | RunEventTestFailed
  | RunEventBuildCompleted
  | RunEventGitPush
  | RunEventPrOpened
  | RunEventPreviewReady
  | RunEventError
  | RunEventDone;
