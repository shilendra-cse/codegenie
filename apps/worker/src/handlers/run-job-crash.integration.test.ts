import { scriptedModel } from "@codegenie/agent/testing";
import { DbEnvironmentStore, runs, type Db } from "@codegenie/db";
import { insertRun, testDatabaseOrSkip } from "@codegenie/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@codegenie/runner", () => ({
  runJob: vi.fn(async () => {
    throw new Error("runner bug");
  }),
}));

const { handleRunJob } = await import("./run-job.js");
const database = await testDatabaseOrSkip("run-job handler crash");

describe.skipIf(!database)("run-job handler when runJob throws", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  it("fails the job with the error and passes it on", async () => {
    const { project, run: job } = await insertRun(db);
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

    await expect(
      handleRunJob(
        {
          db,
          publisher: { publish: async () => 1 },
          log: () => {},
          model: scriptedModel([]).resolved,
        },
        { jobId: job.id },
      ),
    ).rejects.toThrow("runner bug");

    const [row] = await db.select().from(runs).where(eq(runs.id, job.id));
    expect(row).toMatchObject({
      status: "failed",
      errorCode: "worker_error",
      errorMessage: "runner bug",
      finishedAt: expect.any(Date),
    });
  });
});
