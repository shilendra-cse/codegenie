import type { UserRun } from "@codegenie/db";
import { z } from "zod";

export const runParamsSchema = z.object({
  id: z.uuid("The run id must be a UUID."),
});

export const afterSeqSchema = z.coerce
  .number("The last event id must be a number.")
  .int()
  .min(0)
  .default(0);

export type RunResponse = {
  id: string;
  taskId: string;
  trigger: UserRun["trigger"];
  status: UserRun["status"];
  stage: UserRun["stage"];
  model: string;
  summary: string | null;
  checksPassed: boolean | null;
  commitSha: string | null;
  error: { code: string; message: string | null } | null;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  changes: {
    files: { path: string; added: number | null; removed: number | null }[];
    truncated: boolean;
  } | null;
};

export function runDurationMs(run: Pick<UserRun, "startedAt" | "finishedAt">) {
  return run.startedAt && run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null;
}

export function toRunResponse(run: UserRun): RunResponse {
  return {
    id: run.id,
    taskId: run.taskId,
    trigger: run.trigger,
    status: run.status,
    stage: run.stage,
    model: run.model,
    summary: run.summary,
    checksPassed: run.checksPassed,
    commitSha: run.commitSha,
    error: run.errorCode
      ? { code: run.errorCode, message: run.errorMessage }
      : null,
    steps: run.steps,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    costUsd: Number(run.costUsd),
    queuedAt: run.queuedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: runDurationMs(run),
    changes: run.diff ?? null,
  };
}
