import { randomUUID } from "node:crypto";
import {
  type Db,
  DbEnvironmentStore,
  getInstallationById,
  markInstallationUninstalled,
  messages,
  runs,
  setInstallationSuspended,
  setUserPlan,
  tasks,
} from "@hobai/db";
import {
  insertProject,
  insertTask,
  testDatabaseOrSkip,
} from "@hobai/db/testing";
import { eq } from "drizzle-orm";
import type { Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createTaskControllers } from "./tasks.controller";
import type { WorkQueue } from "./tasks.types";

const database = await testDatabaseOrSkip("task controllers");

describe.skipIf(!database)("task controllers against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  function fakeQueue(failWith?: Error) {
    const added: { name: string; data: unknown; options: unknown }[] = [];
    const queue: WorkQueue = {
      add(name, data, options) {
        if (failWith) return Promise.reject(failWith);
        added.push({ name, data, options });
        return Promise.resolve({});
      },
    };
    return { queue, added };
  }

  const request = (userId: string, projectId: string, body: unknown) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
      params: { id: projectId },
      body,
    }) as unknown as AuthenticatedRequest;
  const response = {} as Response;
  const deps = { model: "m", dailySpendCapUsd: 1000 };

  async function readyProject() {
    const project = await insertProject(db);
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
    return project;
  }

  it("creates the task, its message and a queued run, and queues the run", async () => {
    const project = await readyProject();
    const { queue, added } = fakeQueue();
    const controllers = createTaskControllers({
      db,
      queue,
      model: "test:model",
      dailySpendCapUsd: 1000,
    });
    const prompt =
      "Add a GET /health endpoint\n\nReturn 503 when the database is down.";

    const result = await controllers.startTask(
      request(project.userId, project.id, { prompt }),
      response,
    );

    expect(result).toMatchObject({
      status: 201,
      data: {
        task: {
          projectId: project.id,
          title: "Add a GET /health endpoint",
          baseBranch: "main",
        },
        run: { status: "queued", model: "test:model" },
      },
    });
    const { task, run } = result.data as {
      task: { id: string };
      run: { id: string };
    };
    expect(added).toEqual([
      { name: "run-task", data: { runId: run.id }, options: { jobId: run.id } },
    ]);
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.taskId, task.id));
    expect(message).toMatchObject({
      runId: run.id,
      role: "user",
      content: prompt,
      authorUserId: project.userId,
    });
  });

  it("starts from the given base branch", async () => {
    const project = await readyProject();
    const controllers = createTaskControllers({
      db,
      queue: fakeQueue().queue,
      ...deps,
    });

    const result = await controllers.startTask(
      request(project.userId, project.id, {
        prompt: "Fix it",
        baseBranch: "release/2.0",
      }),
      response,
    );

    expect(result).toMatchObject({
      data: { task: { baseBranch: "release/2.0" } },
    });
  });

  it.each([
    [
      "a project without an environment",
      "not-set-up",
      409,
      "PROJECT_NOT_SET_UP",
    ],
    [
      "a project whose setup needs attention",
      "needs-attention",
      409,
      "PROJECT_NEEDS_ATTENTION",
    ],
    ["a suspended App", "suspended", 409, "GITHUB_INSTALLATION_SUSPENDED"],
    ["an uninstalled App", "uninstalled", 409, "GITHUB_INSTALLATION_REMOVED"],
    ["someone else's project", "someone-else", 404, "PROJECT_NOT_FOUND"],
  ])("refuses %s and creates nothing", async (_case, state, status, code) => {
    const project =
      state === "not-set-up" ? await insertProject(db) : await readyProject();
    const installation = await getInstallationById(db, project.installationId);
    if (state === "needs-attention") {
      await new DbEnvironmentStore(db).markHealth(
        project.id,
        "needs_attention",
        ["Install failed."],
      );
    }
    if (state === "suspended") {
      await setInstallationSuspended(db, installation!.installationId, true);
    }
    if (state === "uninstalled") {
      await markInstallationUninstalled(db, installation!.installationId);
    }
    const { queue, added } = fakeQueue();
    const controllers = createTaskControllers({ db, queue, ...deps });
    const userId = state === "someone-else" ? randomUUID() : project.userId;

    await expect(
      controllers.startTask(
        request(userId, project.id, { prompt: "Fix it" }),
        response,
      ),
    ).rejects.toMatchObject({ status, code });

    expect(added).toEqual([]);
    expect(
      await db.select().from(tasks).where(eq(tasks.projectId, project.id)),
    ).toEqual([]);
  });

  it("fails the run and answers 503 when the queue is down", async () => {
    const project = await readyProject();
    const controllers = createTaskControllers({
      db,
      queue: fakeQueue(new Error("Connection is closed.")).queue,
      ...deps,
    });

    await expect(
      controllers.startTask(
        request(project.userId, project.id, { prompt: "Fix it" }),
        response,
      ),
    ).rejects.toMatchObject({ status: 503, code: "QUEUE_UNAVAILABLE" });

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id));
    const [run] = await db.select().from(runs).where(eq(runs.taskId, task.id));
    expect(run).toMatchObject({
      status: "failed",
      errorCode: "queue_unavailable",
      errorMessage: "Connection is closed.",
    });
  });

  describe("the plan's limits", () => {
    const start = async (userId: string, projectId: string, capUsd = 1000) =>
      createTaskControllers({
        db,
        queue: fakeQueue().queue,
        model: "m",
        dailySpendCapUsd: capUsd,
      }).startTask(request(userId, projectId, { prompt: "Fix it" }), response);

    async function useRuns(project: { id: string; userId: string }, n: number) {
      for (let i = 0; i < n; i++) {
        const task = await insertTask(db, project);
        await db.insert(runs).values({
          taskId: task.id,
          trigger: "initial",
          model: "m",
          status: "succeeded",
        });
      }
    }

    it("refuses a second task while one is running", async () => {
      const project = await readyProject();
      await start(project.userId, project.id);

      await expect(start(project.userId, project.id)).rejects.toMatchObject({
        status: 409,
        code: "RUN_IN_PROGRESS",
        message:
          "You already have a task running. Wait for it to finish, or cancel it.",
      });
    });

    it("refuses once the cycle's 10 runs are used, saying when they reset", async () => {
      const project = await readyProject();
      await useRuns(project, 10);

      const refusal = await start(project.userId, project.id).catch(
        (error: unknown) => error,
      );

      expect(refusal).toMatchObject({
        status: 429,
        code: "RUN_LIMIT_REACHED",
        message: expect.stringMatching(
          /^You've used all 10 runs this cycle\. They reset on \d{1,2} [A-Z][a-z]{2}\.$/,
        ) as string,
        data: { resetsAt: expect.any(String) as string },
      });
    });

    it("has no run limit on the unlimited plan", async () => {
      const project = await readyProject();
      await useRuns(project, 10);
      await setUserPlan(db, project.userId, "unlimited");

      await expect(start(project.userId, project.id)).resolves.toMatchObject({
        status: 201,
      });
    });

    it("refuses everyone once today's spend reaches the cap", async () => {
      const project = await readyProject();

      await expect(start(project.userId, project.id, 0)).rejects.toMatchObject({
        status: 503,
        code: "DAILY_CAPACITY_REACHED",
      });
      expect(
        await db.select().from(tasks).where(eq(tasks.projectId, project.id)),
      ).toEqual([]);
    });
  });

  it.each([
    ["an empty prompt", { prompt: "   " }],
    [
      "a branch name with spaces",
      { prompt: "Fix it", baseBranch: "my branch" },
    ],
  ])("refuses %s", async (_case, body) => {
    const controllers = createTaskControllers({
      db,
      queue: fakeQueue().queue,
      ...deps,
    });
    await expect(
      controllers.startTask(
        request(randomUUID(), randomUUID(), body),
        response,
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
