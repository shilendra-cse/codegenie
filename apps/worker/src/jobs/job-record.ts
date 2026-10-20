import { jobs, type Db } from "@codegenie/db";
import type { JobResult } from "@codegenie/runner";
import type { JobEvent } from "@codegenie/shared";
import { and, eq, inArray } from "drizzle-orm";
import { createSerialQueue } from "../lib/serial-queue.js";

export class JobStateError extends Error {}

export type JobFailure = { code: string; message: string };

export type JobRecord = {
  start(environmentId: string): Promise<void>;
  observe(event: JobEvent): void;
  flush(): Promise<void>;
  /** False when the job was already ended elsewhere (e.g. by the reaper). */
  finish(result: JobResult): Promise<boolean>;
  fail(failure: JobFailure): Promise<boolean>;
};

type AgentResult = NonNullable<JobResult["agent"]>;

function failureOf(result: JobResult, agent?: AgentResult): JobFailure | null {
  if (result.status === "failed") {
    return {
      code: `${result.failedStage ?? "agent"}_failed`,
      message: result.error ?? agent?.error ?? "The job failed.",
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

export function createJobRecord(db: Db, jobId: string): JobRecord {
  const updates = createSerialQueue();
  const update = (values: Partial<typeof jobs.$inferInsert>) =>
    db
      .update(jobs)
      .set(values)
      .where(eq(jobs.id, jobId))
      .then(() => {});

  const end = async (
    values: Partial<typeof jobs.$inferInsert>,
    from: ("queued" | "running")[],
  ) => {
    const ended = await db
      .update(jobs)
      .set({ ...values, finishedAt: new Date() })
      .where(and(eq(jobs.id, jobId), inArray(jobs.status, from)))
      .returning({ id: jobs.id });
    return ended.length > 0;
  };

  return {
    async start(environmentId) {
      const started = await db
        .update(jobs)
        .set({ status: "running", startedAt: new Date(), environmentId })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, "queued")))
        .returning({ id: jobs.id });
      if (started.length === 0) {
        throw new JobStateError(`Job ${jobId} isn't queued.`);
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
      const failure = failureOf(result, agent);
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
