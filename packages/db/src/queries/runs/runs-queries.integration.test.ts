import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { DbEnvironmentStore } from "../projects/environments-queries.js";
import { insertRun, testDatabaseOrSkip } from "../../testing/index.js";
import {
  getRunWithProject,
  markRunEnded,
  markRunStarted,
  updateRunProgress,
} from "./runs-queries.js";

const database = await testDatabaseOrSkip("runs queries");

describe.skipIf(!database)("runs queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  async function runWithEnvironment() {
    const { project, run } = await insertRun(db);
    const environment = await new DbEnvironmentStore(db).save(
      project.id,
      {
        version: 1,
        steps: [],
        checks: [],
        meta: { source: "detected", createdAt: "", decisions: [] },
      },
      "detected",
    );
    return { project, run, environmentId: environment.id };
  }

  it("loads a run with its task and project", async () => {
    const { project, task, run } = await insertRun(db);

    expect(await getRunWithProject(db, run.id)).toMatchObject({
      id: run.id,
      task: { id: task.id, project: { id: project.id } },
    });
    expect(await getRunWithProject(db, randomUUID())).toBeNull();
  });

  it("starts a run only while it's queued", async () => {
    const { run, environmentId } = await runWithEnvironment();

    expect(await markRunStarted(db, run.id, environmentId)).toBe(true);
    expect(await markRunStarted(db, run.id, environmentId)).toBe(false);
    expect(await getRunWithProject(db, run.id)).toMatchObject({
      status: "running",
      environmentId,
      startedAt: expect.any(Date),
    });
  });

  it("records the stage and the sandbox", async () => {
    const { run } = await insertRun(db);

    await updateRunProgress(db, run.id, { stage: "setup" });
    await updateRunProgress(db, run.id, { sandboxId: "cg-1" });

    expect(await getRunWithProject(db, run.id)).toMatchObject({
      stage: "setup",
      sandboxId: "cg-1",
    });
  });

  it("ends a run only from the given statuses", async () => {
    const { run } = await insertRun(db);
    const outcome = {
      status: "failed" as const,
      errorCode: "worker_lost",
      errorMessage: "The worker stopped.",
    };

    expect(await markRunEnded(db, run.id, outcome, ["running"])).toBe(false);
    expect(await markRunEnded(db, run.id, outcome, ["queued"])).toBe(true);
    expect(await getRunWithProject(db, run.id)).toMatchObject({
      ...outcome,
      finishedAt: expect.any(Date),
    });
  });
});
