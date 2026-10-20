import { scriptedModel, type ScriptedStep } from "@codegenie/agent/testing";
import {
  DbEnvironmentStore,
  runEvents,
  runs,
  messages,
  type Db,
} from "@codegenie/db";
import { insertRun, testDatabaseOrSkip } from "@codegenie/db/testing";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { EnvironmentConfig, RunEvent } from "@codegenie/shared";
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Publisher } from "../events/sink.js";
import { handleRunTask, type RunTaskDeps } from "./run-task.js";

const database = await testDatabaseOrSkip("run-task handler");

const environment = (cwd = "."): EnvironmentConfig => ({
  version: 1,
  steps: [{ name: "install", cwd, command: "npm ci" }],
  checks: [{ name: "test", cwd, command: "npm run test" }],
  meta: { source: "detected", createdAt: "", decisions: [] },
});

const finish: ScriptedStep = {
  toolCalls: [
    { toolName: "finish_task", input: { summary: "Added GET /health." } },
  ],
};

function fakeSandbox(failOn?: string) {
  const sandbox = new FakeSandbox({
    "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
    "src/app.js": "export const a = 1;\n",
  });
  sandbox.execHandler = (command) => {
    if (failOn && command.includes(failOn))
      return { exitCode: 128, stderr: "repository not found" };
    if (command.includes("git rev-parse HEAD")) return { stdout: "base123\n" };
    return {};
  };
  return sandbox;
}

describe.skipIf(!database)("run-task handler against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  async function setUp(
    options: { environment?: EnvironmentConfig; message?: string } = {},
  ) {
    const { project, task, run } = await insertRun(db);
    if (options.environment) {
      await new DbEnvironmentStore(db).save(
        project.id,
        options.environment,
        "detected",
      );
    }
    if (options.message) {
      await db.insert(messages).values({
        taskId: task.id,
        runId: run.id,
        role: "user",
        content: options.message,
      });
    }
    const published: RunEvent[] = [];
    const publisher: Publisher = {
      async publish(_channel, message) {
        published.push(JSON.parse(message) as RunEvent);
        return 1;
      },
    };
    const logs: string[] = [];
    let sandboxes = 0;
    const depsFor = (script: ScriptedStep[], sandbox = fakeSandbox()) => {
      const { model, resolved } = scriptedModel(script);
      const value: RunTaskDeps = {
        db,
        publisher,
        log: (_level, message) => logs.push(message),
        model: resolved,
        createSandbox: async () => {
          sandboxes += 1;
          return sandbox;
        },
      };
      return { deps: value, model };
    };
    return {
      project,
      run,
      published,
      logs,
      depsFor,
      sandboxes: () => sandboxes,
    };
  }

  const row = async (runId: string) =>
    (await db.select().from(runs).where(eq(runs.id, runId)))[0]!;
  const stored = (runId: string) =>
    db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId))
      .orderBy(asc(runEvents.seq));

  it("runs a run with the project's environment and records everything", async () => {
    const { project, run, published, depsFor } = await setUp({
      environment: environment(),
      message: "Add a GET /health endpoint",
    });
    const { deps, model } = depsFor([finish]);

    const result = await handleRunTask(deps, { runId: run.id });

    expect(result?.status).toBe("succeeded");
    expect(JSON.stringify(model.doStreamCalls[0]!.prompt)).toContain(
      "Add a GET /health endpoint",
    );
    const active = await new DbEnvironmentStore(db).load(project.id);
    expect(await row(run.id)).toMatchObject({
      status: "succeeded",
      environmentId: active!.id,
      sandboxId: "fake-sandbox",
      stage: "verify",
      summary: "Added GET /health.",
      finishedAt: expect.any(Date),
    });

    const events = await stored(run.id);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events[0]).toMatchObject({
      type: "stage_changed",
      payload: { stage: "prepare" },
    });
    expect(events.at(-1)).toMatchObject({
      type: "done",
      payload: { status: "succeeded" },
    });
    expect(published.at(-1)).toMatchObject({
      type: "done",
      seq: events.length,
    });
  });

  it("uses the task title when the run has no message", async () => {
    const { run, depsFor } = await setUp({ environment: environment() });
    const { deps, model } = depsFor([finish]);
    await handleRunTask(deps, { runId: run.id });
    expect(JSON.stringify(model.doStreamCalls[0]!.prompt)).toContain(
      "Add a /health endpoint",
    );
  });

  it("fails a run whose project hasn't been set up, without a sandbox", async () => {
    const { run, depsFor, sandboxes } = await setUp();
    expect(
      await handleRunTask(depsFor([finish]).deps, { runId: run.id }),
    ).toBeNull();
    expect(await row(run.id)).toMatchObject({
      status: "failed",
      errorCode: "no_environment",
      errorMessage:
        "acme/app hasn't been set up yet; onboard the project first.",
    });
    expect(sandboxes()).toBe(0);
  });

  it("skips a run that isn't queued", async () => {
    const { run, depsFor, logs, sandboxes } = await setUp({
      environment: environment(),
    });
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, run.id));
    expect(
      await handleRunTask(depsFor([finish]).deps, { runId: run.id }),
    ).toBeNull();
    expect(logs).toEqual(["Skipping a run that isn't queued"]);
    expect(sandboxes()).toBe(0);
    expect(await row(run.id)).toMatchObject({
      status: "running",
      startedAt: null,
    });
  });

  it("records a failed checkout with an error and a done event", async () => {
    const { run, depsFor } = await setUp({ environment: environment() });
    const result = await handleRunTask(
      depsFor([finish], fakeSandbox("git clone")).deps,
      { runId: run.id },
    );

    expect(result?.status).toBe("failed");
    expect(await row(run.id)).toMatchObject({
      status: "failed",
      errorCode: "checkout_failed",
    });
    const types = (await stored(run.id)).map((e) => [e.type, e.payload]);
    expect(types.slice(-2)).toEqual([
      [
        "error",
        {
          code: "checkout_failed",
          message: "git clone failed: repository not found",
        },
      ],
      ["done", { status: "failed" }],
    ]);
  });

  it("marks the environment when setup reports a problem", async () => {
    const { project, run, depsFor } = await setUp({
      environment: environment("api"),
    });
    await handleRunTask(depsFor([finish]).deps, { runId: run.id });
    expect(
      (await new DbEnvironmentStore(db).load(project.id))!.health,
    ).toMatchObject({
      status: "needs_attention",
      reasons: [
        "The repository root has its own package.json but isn't covered by the environment.",
      ],
    });
  });

  it("refuses a run that doesn't exist", async () => {
    const { depsFor } = await setUp();
    await expect(
      handleRunTask(depsFor([finish]).deps, {
        runId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow("doesn't exist");
  });
});
