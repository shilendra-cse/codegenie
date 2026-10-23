import { z } from "zod";

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

export const runParamsSchema = z.object({
  id: z.uuid("The run id must be a UUID."),
});

export const afterSeqSchema = z.coerce
  .number("The last event id must be a number.")
  .int()
  .min(0)
  .default(0);

export type ChangedFile = {
  path: string;
  added: number | null;
  removed: number | null;
};

export type RunError = { code: string; message: string | null };

export type RunResponse = {
  id: string;
  taskId: string;
  trigger: RunTrigger;
  status: RunStatus;
  stage: RunStage | null;
  model: string;
  summary: string | null;
  checksPassed: boolean | null;
  commitSha: string | null;
  error: RunError | null;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  changes: { files: ChangedFile[]; truncated: boolean } | null;
};

export type RunDiff = {
  patch: string;
  files: ChangedFile[];
  truncated: boolean;
};

export type CancelOutcome = "cancelled" | "stopping";
