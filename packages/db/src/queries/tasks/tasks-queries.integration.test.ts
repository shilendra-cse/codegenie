import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { messages, runs, tasks } from "../../schema/index.js";
import {
  insertProject,
  insertTask,
  testDatabaseOrSkip,
} from "../../testing/index.js";
import { saveRunDiff } from "../runs/run-diffs-queries.js";
import {
  countUserTasks,
  createTaskWithRun,
  findUserTask,
  findUserTasks,
  setTaskBranch,
  setTaskPullRequest,
  setTaskStatusForPullRequest,
} from "./tasks-queries.js";

const database = await testDatabaseOrSkip("tasks queries");

describe.skipIf(!database)("tasks queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const values = (project: { id: string; userId: string }) => ({
    task: {
      projectId: project.id,
      createdByUserId: project.userId,
      title: "Add a README",
      baseBranch: "main",
    },
    run: { trigger: "initial" as const, model: "test:scripted" },
    message: { authorUserId: project.userId, content: "Add a README" },
  });

  it("creates the task, its queued run and the user's message, linked", async () => {
    const project = await insertProject(db);

    const { task, run } = await createTaskWithRun(db, values(project));

    expect(run).toMatchObject({ taskId: task.id, status: "queued" });
    expect(
      await db.select().from(messages).where(eq(messages.taskId, task.id)),
    ).toMatchObject([{ runId: run.id, role: "user", content: "Add a README" }]);
  });

  it("records the task's branch, then its pull request", async () => {
    const project = await insertProject(db);
    const { task } = await createTaskWithRun(db, values(project));

    await setTaskBranch(db, task.id, "codegenie/1234abcd-add-a-readme");
    await setTaskPullRequest(db, task.id, {
      number: 7,
      url: "https://github.com/acme/app/pull/7",
      draft: true,
    });

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row).toMatchObject({
      branchName: "codegenie/1234abcd-add-a-readme",
      prNumber: 7,
      prUrl: "https://github.com/acme/app/pull/7",
      prDraft: true,
      status: "pr_open",
    });
  });

  it("sets the status of the task with that pull request in that repository only", async () => {
    const project = await insertProject(db);
    const other = await insertProject(db);
    const task = await insertTask(db, project, {
      prNumber: 3,
      status: "pr_open",
    });
    const sameNumberElsewhere = await insertTask(db, other, {
      prNumber: 3,
      status: "pr_open",
    });

    const changed = await setTaskStatusForPullRequest(
      db,
      { repoGithubId: project.repoGithubId, number: 3 },
      "merged",
    );
    const unknown = await setTaskStatusForPullRequest(
      db,
      { repoGithubId: project.repoGithubId, number: 4 },
      "closed",
    );

    expect(changed).toEqual([{ id: task.id }]);
    expect(unknown).toEqual([]);
    const status = async (id: string) =>
      (await db.select().from(tasks).where(eq(tasks.id, id)))[0]!.status;
    expect(await status(task.id)).toBe("merged");
    expect(await status(sameNumberElsewhere.id)).toBe("pr_open");
  });

  it("creates nothing when part of it fails", async () => {
    const project = await insertProject(db);
    const broken = {
      ...values(project),
      message: { authorUserId: "no-such-user", content: "x" },
    };

    await expect(createTaskWithRun(db, broken)).rejects.toThrow();

    expect(
      await db.select().from(tasks).where(eq(tasks.projectId, project.id)),
    ).toEqual([]);
  });

  describe("reading a user's tasks", () => {
    it("lists the user's tasks newest first, with their project and runs, a page at a time", async () => {
      const project = await insertProject(db);
      const other = await insertProject(db, {
        userId: project.userId,
        installationId: project.installationId,
      });
      const first = await createTaskWithRun(db, values(project));
      const second = await createTaskWithRun(db, values(project));
      const third = await createTaskWithRun(db, values(other));
      await createTaskWithRun(db, values(await insertProject(db)));

      const page = await findUserTasks(db, project.userId, { limit: 2 });
      const next = await findUserTasks(db, project.userId, {
        limit: 2,
        afterTaskId: page.at(-1)!.id,
      });
      const filtered = await findUserTasks(db, project.userId, {
        projectId: project.id,
        limit: 10,
      });

      expect(page.map((t) => t.id)).toEqual([third.task.id, second.task.id]);
      expect(next.map((t) => t.id)).toEqual([first.task.id]);
      expect(filtered.map((t) => t.id)).toEqual([
        second.task.id,
        first.task.id,
      ]);
      expect(page[0]).toMatchObject({
        project: { id: other.id, repoOwner: "acme", repoName: "app" },
        runs: [{ id: third.run.id, status: "queued" }],
      });
    });

    it("filters by the latest run, then the pull request, and counts each filter", async () => {
      const project = await insertProject(db);
      const other = await insertProject(db, {
        userId: project.userId,
        installationId: project.installationId,
      });
      const withRuns = async (
        values: Partial<typeof tasks.$inferInsert>,
        statuses: (typeof runs.$inferInsert)["status"][],
        on: { id: string; userId: string } = project,
      ) => {
        const task = await insertTask(db, on, values);
        for (const [i, status] of statuses.entries()) {
          await db.insert(runs).values({
            taskId: task.id,
            trigger: "initial",
            model: "test:scripted",
            status,
            queuedAt: new Date(Date.now() + i * 1000),
          });
        }
        return task.id;
      };
      const noRuns = await withRuns({}, []);
      const queued = await withRuns({}, ["queued"]);
      const failed = await withRuns({}, ["failed"]);
      const prOpen = await withRuns({ status: "pr_open" }, ["succeeded"]);
      const prRunningAgain = await withRuns({ status: "pr_open" }, [
        "succeeded",
        "running",
      ]);
      const merged = await withRuns({ status: "merged" }, ["succeeded"]);
      const otherProject = await withRuns({ status: "pr_open" }, [], other);
      await withRuns({}, ["running"], await insertProject(db));

      const ids = async (
        filter: "running" | "pr" | "done",
        projectId?: string,
      ) =>
        (
          await findUserTasks(db, project.userId, {
            filter,
            projectId,
            limit: 10,
          })
        ).map((t) => t.id);

      expect(await ids("running")).toEqual([prRunningAgain, queued]);
      expect(await ids("pr")).toEqual([otherProject, prOpen]);
      expect(await ids("pr", project.id)).toEqual([prOpen]);
      expect(await ids("done")).toEqual([merged, failed, noRuns]);
      expect(await countUserTasks(db, project.userId)).toEqual({
        all: 7,
        running: 2,
        pr: 2,
        done: 3,
      });
      expect(
        await countUserTasks(db, project.userId, { projectId: project.id }),
      ).toEqual({ all: 6, running: 2, pr: 1, done: 3 });

      const firstDone = await findUserTasks(db, project.userId, {
        filter: "done",
        limit: 1,
      });
      const nextDone = await findUserTasks(db, project.userId, {
        filter: "done",
        afterTaskId: firstDone[0]!.id,
        limit: 10,
      });
      expect(nextDone.map((t) => t.id)).toEqual([failed, noRuns]);
    });

    it("gets a task with its messages and runs, newest run first, only for its owner", async () => {
      const project = await insertProject(db);
      const { task, run } = await createTaskWithRun(db, values(project));
      await saveRunDiff(db, run.id, {
        patch: "diff --git a/README.md b/README.md",
        files: [{ path: "README.md", added: 1, removed: 0 }],
        truncated: false,
      });

      const found = await findUserTask(db, project.userId, task.id);

      expect(found).toMatchObject({
        id: task.id,
        project: { id: project.id },
        messages: [{ role: "user", content: "Add a README" }],
        runs: [
          {
            id: run.id,
            diff: {
              files: [{ path: "README.md", added: 1, removed: 0 }],
              truncated: false,
            },
          },
        ],
      });
      expect(found!.runs[0]!.diff).not.toHaveProperty("patch");
      expect(await findUserTask(db, randomUUID(), task.id)).toBeNull();
      expect(await findUserTask(db, project.userId, randomUUID())).toBeNull();
    });
  });
});
