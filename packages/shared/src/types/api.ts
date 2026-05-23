// --- Project ---

export type ProjectStatus =
  | "provisioning"
  | "ready"
  | "failed";

export type Project = {
  id: string;
  userId: string;
  name: string;
  githubOwner: string | null;
  githubRepo: string | null;
  workspacePath?: string;
  previewPort?: number | null;
  status: ProjectStatus;
  createdAt: string;
};

export type CreateProjectRequest = {
  name: string;
  mode: "create" | "connect";
  repoFullName?: string;
};

// --- Chat messages ---

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type ProjectWithMessages = Project & {
  messages: Message[];
};

// --- Jobs ---

export type JobStatus = "queued" | "running" | "done" | "failed";

export type Job = {
  id: string;
  projectId: string;
  status: JobStatus;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type CreatePromptResponse = {
  jobId: string;
};

// --- Job events (Redis channel + SSE) ---

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
  | JobEventError
  | JobEventDone;

/** Redis channel: `job:{jobId}` */
export function jobChannel(jobId: string): string {
  return `job:${jobId}`;
}
