import {
  DbEnvironmentStore,
  jobs,
  projectEnvironments,
  type Db,
} from "@codegenie/db";
import { insertJob, testDatabaseOrSkip } from "@codegenie/db/testing";
import type { JobResult } from "@codegenie/runner";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createJobRecord, JobStateError } from "./job-record.js";

const database = await testDatabaseOrSkip("job record");

type AgentResult = NonNullable<JobResult["agent"]>;
const agent = (overrides: Partial<AgentResult> = {}): AgentResult => ({
  status: "succeeded",
  summary: "Added GET /health.",
  steps: 9,
  durationMs: 60_000,
  model: "test:scripted",
  usage: {
    inputTokens: 12_000,
    cachedInputTokens: 8_000,
    outputTokens: 900,
    costUsd: 0.00412,
  },
  compactions: 0,
  messages: [],
  ...overrides,
});

describe.skipIf(!database)("job record against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const row = async (jobId: string) =>
    (await db.select().from(jobs).where(eq(jobs.id, jobId)))[0]!;

  async function newJob() {
    const { project, job } = await insertJob(db);
    await new DbEnvironmentStore(db).save(
      project.id,
      {
        version: 1,
        steps: [],
        checks: [],
        meta: { source: "detected", createdAt: "", decisions: [] },
      },
      "detected",
    );
    const environment = await db.query.projectEnvironments.findFirst({
      where: eq(projectEnvironments.projectId, project.id),
    });
    return {
      job,
      record: createJobRecord(db, job.id),
      environmentId: environment!.id,
    };
  }

  async function startedJob() {
    const created = await newJob();
    await created.record.start(created.environmentId);
    return created;
  }

  it("starts a queued job once, with the environment version it replays", async () => {
    const { job, record, environmentId } = await newJob();
    await record.start(environmentId);
    expect(await row(job.id)).toMatchObject({
      status: "running",
      environmentId,
      startedAt: expect.any(Date),
    });
    await expect(record.start(environmentId)).rejects.toThrow(JobStateError);
  });

  it("records the stage and sandbox in the order they happen", async () => {
    const { job, record } = await newJob();
    record.observe({
      type: "stage_changed",
      jobId: job.id,
      ts: "",
      stage: "prepare",
    });
    record.observe({
      type: "sandbox_created",
      jobId: job.id,
      ts: "",
      sandboxId: "sb-1",
    });
    record.observe({
      type: "tool_start",
      jobId: job.id,
      ts: "",
      toolCallId: "1",
      toolName: "bash",
    });
    record.observe({
      type: "stage_changed",
      jobId: job.id,
      ts: "",
      stage: "agent",
    });
    await record.flush();
    expect(await row(job.id)).toMatchObject({
      stage: "agent",
      sandboxId: "sb-1",
    });
  });

  it("finishes with the summary, usage, cost and check outcome", async () => {
    const { job, record } = await startedJob();
    const recorded = await record.finish({
      status: "succeeded",
      agent: agent(),
      verify: { checks: [], passed: true, fixed: 1, regressions: 0 },
      durationMs: 70_000,
    });

    expect(recorded).toBe(true);
    expect(await row(job.id)).toMatchObject({
      status: "succeeded",
      summary: "Added GET /health.",
      inputTokens: 12_000,
      outputTokens: 900,
      steps: 9,
      costUsd: "0.0041",
      checksPassed: true,
      errorCode: null,
      errorMessage: null,
      finishedAt: expect.any(Date),
    });
  });

  const endings: [string, JobResult, Record<string, unknown>][] = [
    [
      "a failed stage",
      {
        status: "failed",
        failedStage: "checkout",
        error: "git clone failed: not found",
        durationMs: 1,
      },
      {
        status: "failed",
        errorCode: "checkout_failed",
        errorMessage: "git clone failed: not found",
        checksPassed: null,
      },
    ],
    [
      "a failed agent",
      {
        status: "failed",
        agent: agent({ status: "failed", error: "Model request failed: 500" }),
        durationMs: 1,
      },
      {
        status: "failed",
        errorCode: "agent_failed",
        errorMessage: "Model request failed: 500",
      },
    ],
    [
      "a limit",
      {
        status: "incomplete",
        agent: agent({ status: "incomplete", limitReached: "steps" }),
        durationMs: 1,
      },
      {
        status: "incomplete",
        errorCode: "steps_limit",
        errorMessage: "Stopped at the steps limit.",
      },
    ],
    [
      "a cancel",
      { status: "cancelled", durationMs: 1 },
      { status: "cancelled", errorCode: null },
    ],
  ];

  it.each(endings)("finishes after %s", async (_name, result, expected) => {
    const { job, record } = await startedJob();
    expect(await record.finish(result)).toBe(true);
    expect(await row(job.id)).toMatchObject(expected);
  });

  it("doesn't overwrite a job that was ended elsewhere", async () => {
    const { job, record } = await startedJob();
    await db
      .update(jobs)
      .set({ status: "failed", errorCode: "stalled" })
      .where(eq(jobs.id, job.id));

    expect(await record.finish({ status: "succeeded", durationMs: 1 })).toBe(
      false,
    );
    expect(await row(job.id)).toMatchObject({
      status: "failed",
      errorCode: "stalled",
    });
  });

  it("fails a job before it ran, with a reason", async () => {
    const { job, record } = await newJob();
    expect(
      await record.fail({
        code: "no_environment",
        message: "Set the project up first.",
      }),
    ).toBe(true);
    expect(await row(job.id)).toMatchObject({
      status: "failed",
      errorCode: "no_environment",
      errorMessage: "Set the project up first.",
      finishedAt: expect.any(Date),
    });
    expect(await record.fail({ code: "again", message: "x" })).toBe(false);
  });
});
