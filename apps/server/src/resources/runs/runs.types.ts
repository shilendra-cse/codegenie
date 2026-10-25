import type { UserRun } from "@hobai/db";
import type { RunResponse } from "@hobai/shared";

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
