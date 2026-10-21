import { runs, saveRunDiff, type Db } from "@codegenie/db";
import type { Diff, RunResult } from "@codegenie/runner";
import type { RunEvent } from "@codegenie/shared";
import { and, eq, inArray } from "drizzle-orm";
import { createSerialQueue } from "../lib/serial-queue.js";

export class RunStateError extends Error {}

export type RunFailure = { code: string; message: string };

export type RunRecord = {
  start(environmentId: string): Promise<void>;
  observe(event: RunEvent): void;
  flush(): Promise<void>;
  /** False when the run was already ended elsewhere (e.g. by the reaper). */
  finish(result: RunResult): Promise<boolean>;
  fail(failure: RunFailure): Promise<boolean>;
  saveDiff(diff: Diff): Promise<void>;
};

type AgentResult = NonNullable<RunResult["agent"]>;

export function runFailure(result: RunResult): RunFailure | null {
  const agent: AgentResult | undefined = result.agent;
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
  const update = (values: Partial<typeof runs.$inferInsert>) =>
    db
      .update(runs)
      .set(values)
      .where(eq(runs.id, runId))
      .then(() => {});

  const end = async (
    values: Partial<typeof runs.$inferInsert>,
    from: ("queued" | "running")[],
  ) => {
    const ended = await db
      .update(runs)
      .set({ ...values, finishedAt: new Date() })
      .where(and(eq(runs.id, runId), inArray(runs.status, from)))
      .returning({ id: runs.id });
    return ended.length > 0;
  };

  return {
    async start(environmentId) {
      const started = await db
        .update(runs)
        .set({ status: "running", startedAt: new Date(), environmentId })
        .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
        .returning({ id: runs.id });
      if (started.length === 0) {
        throw new RunStateError(`Run ${runId} isn't queued.`);
      }
    },

    observe(event) {
      if (event.type === "stage_changed") {
        updates.add(() => update({ stage: event.stage }));
      } else if (event.type === "sandbox_created") {
        updates.add(() => update({ sandboxId: event.sandboxId }));
      }
    },

    flush: () => updates.drain(),

    finish(result) {
      const agent = result.agent;
      const failure = runFailure(result);
      return end(
        {
          status: result.status,
          summary: agent?.summary ?? null,
          inputTokens: agent?.usage.inputTokens ?? 0,
          outputTokens: agent?.usage.outputTokens ?? 0,
          steps: agent?.steps ?? 0,
          costUsd: (agent?.usage.costUsd ?? 0).toFixed(4),
          checksPassed: result.verify?.passed ?? null,
          errorCode: failure?.code ?? null,
          errorMessage: failure?.message ?? null,
        },
        ["running"],
      );
    },

    saveDiff: ({ patch, files, truncated }) =>
      saveRunDiff(db, runId, { patch, files, truncated }),

    fail(failure) {
      return end(
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
