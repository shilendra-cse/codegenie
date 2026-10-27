import {
  markRunEnded,
  markRunStarted,
  saveRunDiff,
  updateRunProgress,
  type Db,
} from "@hobai/db";
import type { UsageSnapshot } from "@hobai/agent";
import type { Diff, RunResult } from "@hobai/runner";
import type { RunEvent } from "@hobai/shared";
import { createSerialQueue } from "../lib/serial-queue.js";

export class RunStateError extends Error {}

export type RunFailure = { code: string; message: string };

export type RunRecord = {
  start(environmentId: string): Promise<void>;
  observe(event: RunEvent): void;
  /** Model calls made outside the agent (e.g. the task's title), counted with the agent's. */
  addUsage(usage: UsageSnapshot): void;
  flush(): Promise<void>;
  /** False when the run was already ended elsewhere (e.g. by the reaper). */
  finish(result: RunResult): Promise<boolean>;
  fail(failure: RunFailure): Promise<boolean>;
  saveDiff(diff: Diff): Promise<void>;
};

type AgentResult = NonNullable<RunResult["agent"]>;

export function runFailure(result: RunResult): RunFailure | null {
  const agent: AgentResult | undefined = result.agent;
  if (result.timeLimitReached) {
    return {
      code: "time_limit",
      message:
        result.error ??
        "Some checks didn't run: the run reached its time limit.",
    };
  }
  if (result.status === "failed") {
    return {
      code: `${result.failedStage ?? "agent"}_failed`,
      message: result.error ?? agent?.error ?? "The run failed.",
    };
  }
  if (result.status === "incomplete" && agent?.limitReached) {
    return {
      code: `${agent.limitReached}_limit`,
      message: agent.error ?? `Stopped at the ${agent.limitReached} limit.`,
    };
  }
  return null;
}

export function createRunRecord(db: Db, runId: string): RunRecord {
  const updates = createSerialQueue();
  const extra = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  return {
    async start(environmentId) {
      if (!(await markRunStarted(db, runId, environmentId))) {
        throw new RunStateError(`Run ${runId} isn't queued.`);
      }
    },

    observe(event) {
      if (event.type === "stage_changed") {
        updates.add(() => updateRunProgress(db, runId, { stage: event.stage }));
      } else if (event.type === "sandbox_created") {
        updates.add(() =>
          updateRunProgress(db, runId, { sandboxId: event.sandboxId }),
        );
      }
    },

    addUsage(usage) {
      extra.inputTokens += usage.inputTokens;
      extra.outputTokens += usage.outputTokens;
      extra.costUsd += usage.costUsd;
    },

    flush: () => updates.drain(),

    finish(result) {
      const agent = result.agent;
      const failure = runFailure(result);
      return markRunEnded(
        db,
        runId,
        {
          status: result.status,
          summary: agent?.summary ?? null,
          inputTokens: (agent?.usage.inputTokens ?? 0) + extra.inputTokens,
          outputTokens: (agent?.usage.outputTokens ?? 0) + extra.outputTokens,
          steps: agent?.steps ?? 0,
          costUsd: ((agent?.usage.costUsd ?? 0) + extra.costUsd).toFixed(4),
          checksPassed: result.verify?.passed ?? null,
          commitSha: result.delivery?.sha ?? null,
          errorCode: failure?.code ?? null,
          errorMessage: failure?.message ?? null,
        },
        ["running"],
      );
    },

    saveDiff: ({ patch, files, truncated }) =>
      saveRunDiff(db, runId, { patch, files, truncated }),

    fail(failure) {
      return markRunEnded(
        db,
        runId,
        {
          status: "failed",
          errorCode: failure.code,
          errorMessage: failure.message,
        },
        ["queued", "running"],
      );
    },
  };
}
