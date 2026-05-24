// --- Project (projects table) ---

export type ProjectStatus = "provisioning" | "ready" | "failed";

export type Project = {
  id: string;
  userId: string;
  name: string;
  githubOwner: string | null;
  githubRepo: string | null;
  defaultBranch: string;
  workspacePath: string;
  previewPort: number | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectRequest = {
  name: string;
  mode: "create" | "connect";
  repoFullName?: string;
  defaultBranch?: string;
};

// --- Messages (messages table) ---

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  projectId: string;
  jobId: string | null;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type ProjectWithMessages = Project & {
  messages: Message[];
};

export type ProjectDetail = Project & {
  messages: Message[];
  jobs: Job[];
};

// --- Jobs (jobs table) ---

export type JobStatus = "queued" | "running" | "done" | "failed";

export type Job = {
  id: string;
  projectId: string;
  title: string | null;
  status: JobStatus;
  error: string | null;
  branchName: string | null;
  prUrl: string | null;
  commitSha: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type CreateTaskRequest = {
  content: string;
  title?: string;
  baseBranch?: string;
};

export type CreateTaskResponse = {
  jobId: string;
  messageId: string;
};

/** @deprecated Use CreateTaskResponse */
export type CreatePromptResponse = CreateTaskResponse;

// --- Job events audit (job_events table) ---

export type JobEventRecord = {
  id: string;
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ListJobEventsResponse = {
  events: JobEventRecord[];
  nextCursor?: string;
};

// --- Job events stream (Redis pub/sub + SSE) ---

export type JobEventBase = {
  jobId: string;
  ts: string;
};

export type JobEventToolStart = JobEventBase & {
  type: "tool_start";
  toolName: string;
  input?: unknown;
};

export type JobEventToolEnd = JobEventBase & {
  type: "tool_end";
  toolName: string;
  output?: unknown;
};

export type JobEventTextDelta = JobEventBase & {
  type: "text_delta";
  delta: string;
};

export type JobEventPreviewReady = JobEventBase & {
  type: "preview_ready";
  port: number;
};

export type JobEventGitPush = JobEventBase & {
  type: "git_push";
  repoUrl: string;
  sha: string;
};

export type JobEventBranchCreated = JobEventBase & {
  type: "branch_created";
  branchName: string;
};

export type JobEventPrOpened = JobEventBase & {
  type: "pr_opened";
  prUrl: string;
  branchName: string;
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

export type JobEventLintCompleted = JobEventBase & {
  type: "lint_completed";
  success: boolean;
};

export type JobEventBuildCompleted = JobEventBase & {
  type: "build_completed";
  success: boolean;
};

export type JobEventError = JobEventBase & {
  type: "error";
  message: string;
};

export type JobEventDone = JobEventBase & {
  type: "done";
};

export type JobEvent =
  | JobEventToolStart
  | JobEventToolEnd
  | JobEventTextDelta
  | JobEventPreviewReady
  | JobEventGitPush
  | JobEventBranchCreated
  | JobEventPrOpened
  | JobEventTestStarted
  | JobEventTestPassed
  | JobEventTestFailed
  | JobEventLintCompleted
  | JobEventBuildCompleted
  | JobEventError
  | JobEventDone;

/** Redis channel: `job:{jobId}` */
export function jobChannel(jobId: string): string {
  return `job:${jobId}`;
}
