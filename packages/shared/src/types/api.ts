import type { CheckStatus, StepStatus } from "./environment.js";
// Mirrors apps/server/src/db/schema (see docs/knowledge/database.md).
// Timestamps are ISO-8601 strings on the wire.

// --- GitHub installations (github_installations table) ---

export type InstallationAccountType = "user" | "organization";

export type GithubInstallation = {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: InstallationAccountType;
  suspendedAt: string | null;
  createdAt: string;
};

// --- Projects (projects table) ---

export type Project = {
  id: string;
  userId: string;
  installationId: string;
  repoGithubId: number;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectRequest = {
  installationId: string;
  repoGithubId: number;
};

// --- Tasks (tasks table) ---

export type TaskSource = "prompt" | "jira" | "notion";

export type TaskStatus = "open" | "pr_open" | "merged" | "closed";

export type Task = {
  id: string;
  projectId: string;
  createdByUserId: string;
  title: string;
  source: TaskSource;
  sourceRef: string | null;
  sourceUrl: string | null;
  baseBranch: string;
  branchName: string | null;
  prNumber: number | null;
  prUrl: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskRequest = {
  content: string;
  title?: string;
  baseBranch?: string;
};

export type CreateTaskResponse = {
  taskId: string;
  runId: string;
  messageId: string;
};

/** Follow-up message on an existing task; starts a new run on the same branch/PR. */
export type CreateTaskMessageRequest = {
  content: string;
};

export type CreateTaskMessageResponse = {
  runId: string;
  messageId: string;
};

// --- Runs (runs table) ---

export type RunTrigger = "initial" | "follow_up" | "pr_comment" | "retry";

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "incomplete"
  | "failed"
  | "cancelled";

export type FinalRunStatus = Exclude<RunStatus, "queued" | "running">;

export type RunStage =
  | "prepare"
  | "checkout"
  | "setup"
  | "agent"
  | "verify"
  | "deliver";

export type Run = {
  id: string;
  taskId: string;
  trigger: RunTrigger;
  status: RunStatus;
  stage: RunStage | null;
  sandboxId: string | null;
  model: string;
  commitSha: string | null;
  checksPassed: boolean | null;
  summary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  inputTokens: number;
  outputTokens: number;
  steps: number;
  /** Decimal string, e.g. "0.4321" (numeric(10,4) in Postgres). */
  costUsd: string;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

// --- Messages (messages table) ---

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  taskId: string;
  runId: string | null;
  role: MessageRole;
  authorUserId: string | null;
  content: string;
  createdAt: string;
};

// --- Aggregates ---

export type ProjectDetail = Project & {
  tasks: Task[];
};

export type TaskDetail = Task & {
  messages: Message[];
  runs: Run[];
};

// --- Run events audit (run_events table) ---

export type RunEventRecord = {
  runId: string;
  /** 1, 2, 3… per run; also the SSE event id. */
  seq: number;
  type: RunEvent["type"];
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ListRunEventsResponse = {
  events: RunEventRecord[];
  /** Pass as `after` to fetch the next page. */
  nextSeq?: number;
};

// --- Run events stream (Redis pub/sub + SSE) ---

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

export function runChannel(runId: string): string {
  return `run:${runId}`;
}
