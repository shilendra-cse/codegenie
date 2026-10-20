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
  jobId: string;
  messageId: string;
};

/** Follow-up message on an existing task; starts a new job on the same branch/PR. */
export type CreateTaskMessageRequest = {
  content: string;
};

export type CreateTaskMessageResponse = {
  jobId: string;
  messageId: string;
};

// --- Jobs (jobs table) ---

export type JobTrigger = "initial" | "follow_up" | "pr_comment" | "retry";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type JobStage =
  | "prepare"
  | "checkout"
  | "setup"
  | "agent"
  | "verify"
  | "deliver";

export type Job = {
  id: string;
  taskId: string;
  trigger: JobTrigger;
  status: JobStatus;
  stage: JobStage | null;
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
  jobId: string | null;
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
  jobs: Job[];
};

// --- Job events audit (job_events table) ---

export type JobEventRecord = {
  jobId: string;
  /** 1, 2, 3… per job; also the SSE event id. */
  seq: number;
  type: JobEvent["type"];
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ListJobEventsResponse = {
  events: JobEventRecord[];
  /** Pass as `after` to fetch the next page. */
  nextSeq?: number;
};

// --- Job events stream (Redis pub/sub + SSE) ---

export type JobEventBase = {
  jobId: string;
  /** Absent for events that are streamed but not persisted (text_delta). */
  seq?: number;
  ts: string;
};

export type JobEventStageChanged = JobEventBase & {
  type: "stage_changed";
  stage: JobStage;
};

export type JobEventSandboxCreated = JobEventBase & {
  type: "sandbox_created";
  sandboxId: string;
};

export type JobEventSetupStarted = JobEventBase & {
  type: "setup_started";
};

export type JobEventSetupCompleted = JobEventBase & {
  type: "setup_completed";
  success: boolean;
  steps: { name: string; cwd: string; status: StepStatus }[];
  checks: { name: string; cwd: string; status?: CheckStatus }[];
};

export type JobEventToolStart = JobEventBase & {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type JobEventToolEnd = JobEventBase & {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

/** After each model step: progress of the agent run so far. Streamed, not persisted. */
export type JobEventAgentStep = JobEventBase & {
  type: "agent_step";
  steps: number;
  costUsd: number;
};

export type JobEventTextDelta = JobEventBase & {
  type: "text_delta";
  delta: string;
};

export type JobEventBranchCreated = JobEventBase & {
  type: "branch_created";
  branchName: string;
};

export type JobEventLintCompleted = JobEventBase & {
  type: "lint_completed";
  success: boolean;
};

export type JobEventTestStarted = JobEventBase & {
  type: "test_started";
};

export type JobEventTestPassed = JobEventBase & {
  type: "test_passed";
};

export type JobEventTestFailed = JobEventBase & {
  type: "test_failed";
  message?: string;
};

export type JobEventBuildCompleted = JobEventBase & {
  type: "build_completed";
  success: boolean;
};

export type JobEventGitPush = JobEventBase & {
  type: "git_push";
  branchName: string;
  sha: string;
};

export type JobEventPrOpened = JobEventBase & {
  type: "pr_opened";
  prNumber: number;
  prUrl: string;
  draft: boolean;
};

export type JobEventPreviewReady = JobEventBase & {
  type: "preview_ready";
  url: string;
};

export type JobEventError = JobEventBase & {
  type: "error";
  code?: string;
  message: string;
};

export type JobEventDone = JobEventBase & {
  type: "done";
  status: Extract<JobStatus, "succeeded" | "failed" | "cancelled">;
};

export type JobEvent =
  | JobEventStageChanged
  | JobEventSandboxCreated
  | JobEventSetupStarted
  | JobEventSetupCompleted
  | JobEventToolStart
  | JobEventToolEnd
  | JobEventTextDelta
  | JobEventAgentStep
  | JobEventBranchCreated
  | JobEventLintCompleted
  | JobEventTestStarted
  | JobEventTestPassed
  | JobEventTestFailed
  | JobEventBuildCompleted
  | JobEventGitPush
  | JobEventPrOpened
  | JobEventPreviewReady
  | JobEventError
  | JobEventDone;

/** Redis channel: `job:{jobId}` */
export function jobChannel(jobId: string): string {
  return `job:${jobId}`;
}
