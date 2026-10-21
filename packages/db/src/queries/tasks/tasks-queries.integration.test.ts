import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { messages, tasks } from "../../schema/index.js";
import { insertProject, testDatabaseOrSkip } from "../../testing/index.js";
import {
  createTaskWithRun,
  setTaskBranch,
  setTaskPullRequest,
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
    });

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row).toMatchObject({
      branchName: "codegenie/1234abcd-add-a-readme",
      prNumber: 7,
      prUrl: "https://github.com/acme/app/pull/7",
      status: "pr_open",
    });
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
});
