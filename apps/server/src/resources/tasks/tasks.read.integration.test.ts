import { randomUUID } from "node:crypto";
import {
  createTaskWithRun,
  type Db,
  runs,
  saveRunDiff,
  setTaskPullRequest,
  setTaskStatusForPullRequest,
} from "@codegenie/db";
import { insertProject, testDatabaseOrSkip } from "@codegenie/db/testing";
import { eq } from "drizzle-orm";
import type { Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createRunControllers } from "../runs/runs.controller";
import { createTaskControllers } from "./tasks.controller";
import type { TaskDetail, TaskListItem } from "@codegenie/shared";

const database = await testDatabaseOrSkip("task and run reads");

describe.skipIf(!database)("reading tasks and runs against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());
  const tasks = createTaskControllers({
    db,
    queue: { add: () => Promise.resolve({}) },
    model: "test:model",
  });
  const runControllers = createRunControllers({
    db,
    publisher: { publish: () => Promise.resolve(0) },
    hub: { listen: () => Promise.resolve(() => Promise.resolve()) },
    heartbeatMs: 15_000,
  });

  const request = (
    userId: string,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
  ) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
      params,
      query,
    }) as unknown as AuthenticatedRequest;
  const response = {} as Response;

  type RunState = Partial<typeof runs.$inferInsert>;

  async function task(
    project: { id: string; userId: string },
    run: RunState = {},
    title = "Add a README",
  ) {
    const created = await createTaskWithRun(db, {
      task: {
        projectId: project.id,
        createdByUserId: project.userId,
        title,
        baseBranch: "main",
      },
      run: { trigger: "initial", model: "test:model" },
      message: { authorUserId: project.userId, content: title },
    });
    if (Object.keys(run).length > 0) {
      await db.update(runs).set(run).where(eq(runs.id, created.run.id));
    }
    return created;
  }

  const list = async (userId: string, query: Record<string, string> = {}) =>
    (await tasks.listTasks(request(userId, {}, query), response)).data as {
      tasks: TaskListItem[];
      nextCursor: string | null;
    };

  it("labels each task from its pull request and latest run", async () => {
    const project = await insertProject(db);
    const ended = { startedAt: new Date(), finishedAt: new Date() };
    const queued = await task(project);
    const working = await task(project, { status: "running" });
    const failed = await task(project, { status: "failed", ...ended });
    const cancelled = await task(project, { status: "cancelled" });
    const noChanges = await task(project, { status: "succeeded", ...ended });
    const prOpen = await task(project, { status: "succeeded", ...ended });
    const prDraft = await task(project, { status: "incomplete", ...ended });
    const merged = await task(project, { status: "succeeded", ...ended });
    const closed = await task(project, { status: "succeeded", ...ended });
    const pr = (number: number, draft = false) => ({
      number,
      url: `https://github.com/acme/app/pull/${number}`,
      draft,
    });
    await setTaskPullRequest(db, prOpen.task.id, pr(1));
    await setTaskPullRequest(db, prDraft.task.id, pr(2, true));
    for (const [t, n] of [
      [merged, 3],
      [closed, 4],
    ] as const) {
      await setTaskPullRequest(db, t.task.id, pr(n));
    }
    await setTaskStatusForPullRequest(
      db,
      { repoGithubId: project.repoGithubId, number: 3 },
      "merged",
    );
    await setTaskStatusForPullRequest(
      db,
      { repoGithubId: project.repoGithubId, number: 4 },
      "closed",
    );

    const labels = new Map(
      (await list(project.userId)).tasks.map((t) => [t.id, t.label]),
    );

    expect(
      [
        queued,
        working,
        failed,
        cancelled,
        noChanges,
        prOpen,
        prDraft,
        merged,
        closed,
      ].map((t) => labels.get(t.task.id)),
    ).toEqual([
      "queued",
      "working",
      "failed",
      "cancelled",
      "no_changes",
      "pr_open",
      "pr_draft",
      "merged",
      "closed",
    ]);
  });

  it("lists only the user's tasks, newest first, by project, a page of 50 at a time", async () => {
    const project = await insertProject(db);
    const other = await insertProject(db, {
      userId: project.userId,
      installationId: project.installationId,
    });
    const created = [];
    for (let i = 0; i < 50; i += 1) created.push(await task(project));
    const newest = await task(other);
    await task(await insertProject(db));

    const first = await list(project.userId);
    const second = await list(project.userId, { cursor: first.nextCursor! });
    const filtered = await list(project.userId, { projectId: other.id });

    expect(first.tasks).toHaveLength(50);
    expect(first.tasks[0].id).toBe(newest.task.id);
    expect(second).toEqual({
      tasks: [expect.objectContaining({ id: created[0].task.id })],
      nextCursor: null,
    });
    expect(filtered.tasks.map((t) => t.id)).toEqual([newest.task.id]);
    expect(filtered.tasks[0]).toMatchObject({
      title: "Add a README",
      project: { id: other.id, owner: "acme", name: "app" },
      pullRequest: null,
      runCount: 1,
    });
  });

  it("gets a task with its messages, its runs and their totals, only for its owner", async () => {
    const project = await insertProject(db);
    const started = new Date("2026-10-20T10:00:00Z");
    const { task: created, run } = await task(project, {
      status: "succeeded",
      startedAt: started,
      finishedAt: new Date(started.getTime() + 90_000),
      costUsd: "0.1234",
      summary: "Added the README.",
    });
    await saveRunDiff(db, run.id, {
      patch: "diff --git a/README.md b/README.md\n+# App\n",
      files: [{ path: "README.md", added: 1, removed: 0 }],
      truncated: false,
    });

    const result = await tasks.getTask(
      request(project.userId, { id: created.id }),
      response,
    );

    expect(result.data).toMatchObject({
      task: {
        id: created.id,
        label: "no_changes",
        durationMs: 90_000,
        costUsd: 0.1234,
        messages: [{ role: "user", content: "Add a README", runId: run.id }],
        runs: [
          {
            id: run.id,
            status: "succeeded",
            summary: "Added the README.",
            durationMs: 90_000,
            costUsd: 0.1234,
            error: null,
            changes: {
              files: [{ path: "README.md", added: 1, removed: 0 }],
              truncated: false,
            },
          },
        ],
      },
    });
    expect(
      (result.data as { task: TaskDetail }).task.runs[0].changes,
    ).not.toHaveProperty("patch");
    await expect(
      tasks.getTask(request(randomUUID(), { id: created.id }), response),
    ).rejects.toMatchObject({ status: 404, code: "TASK_NOT_FOUND" });
  });

  it("gets a run and its diff, only for the owner of its project", async () => {
    const project = await insertProject(db);
    const withDiff = await task(project, {
      status: "failed",
      errorCode: "deliver_failed",
      errorMessage: "GitHub said no",
    });
    const withoutDiff = await task(project, { status: "succeeded" });
    await saveRunDiff(db, withDiff.run.id, {
      patch: "diff --git a/a.ts b/a.ts\n",
      files: [{ path: "a.ts", added: 1, removed: 1 }],
      truncated: false,
    });
    const params = { id: withDiff.run.id };

    expect(
      await runControllers.getRun(request(project.userId, params), response),
    ).toMatchObject({
      data: {
        run: {
          id: withDiff.run.id,
          taskId: withDiff.task.id,
          error: { code: "deliver_failed", message: "GitHub said no" },
        },
      },
    });
    expect(
      await runControllers.getRunDiff(
        request(project.userId, params),
        response,
      ),
    ).toMatchObject({
      data: { diff: { patch: "diff --git a/a.ts b/a.ts\n", truncated: false } },
    });
    expect(
      await runControllers.getRunDiff(
        request(project.userId, { id: withoutDiff.run.id }),
        response,
      ),
    ).toMatchObject({ data: { diff: null } });
    await expect(
      runControllers.getRunDiff(request(randomUUID(), params), response),
    ).rejects.toMatchObject({ status: 404, code: "RUN_NOT_FOUND" });
  });
});
