import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../client.js";
import { projects } from "../../schema/projects/projects-schema.js";
import { runs } from "../../schema/runs/runs-schema.js";
import { messages } from "../../schema/tasks/messages-schema.js";
import { tasks } from "../../schema/tasks/tasks-schema.js";

export type NewTaskWithRun = {
  task: typeof tasks.$inferInsert;
  run: Omit<typeof runs.$inferInsert, "taskId">;
  /** The user's instruction, linked to the task and its run. */
  message: Omit<typeof messages.$inferInsert, "taskId" | "runId" | "role">;
};

/** A task with its first message and queued run, in one transaction. */
export async function createTaskWithRun(db: Db, values: NewTaskWithRun) {
  return db.transaction(async (tx) => {
    const [task] = await tx.insert(tasks).values(values.task).returning();
    const [run] = await tx
      .insert(runs)
      .values({ ...values.run, taskId: task!.id })
      .returning();
    await tx.insert(messages).values({
      ...values.message,
      taskId: task!.id,
      runId: run!.id,
      role: "user",
    });
    return { task: task!, run: run! };
  });
}

export async function setTaskTitle(db: Db, taskId: string, title: string) {
  await db.update(tasks).set({ title }).where(eq(tasks.id, taskId));
}

export async function setTaskBranch(
  db: Db,
  taskId: string,
  branchName: string,
) {
  await db.update(tasks).set({ branchName }).where(eq(tasks.id, taskId));
}

export async function setTaskPullRequest(
  db: Db,
  taskId: string,
  pullRequest: { number: number; url: string; draft: boolean },
) {
  await db
    .update(tasks)
    .set({
      prNumber: pullRequest.number,
      prUrl: pullRequest.url,
      prDraft: pullRequest.draft,
      status: "pr_open",
    })
    .where(eq(tasks.id, taskId));
}

export type TaskStatus = (typeof tasks.$inferSelect)["status"];

/** Sets the status of the task whose pull request this is; returns the tasks changed (none for a PR CodeGenie didn't open). */
export async function setTaskStatusForPullRequest(
  db: Db,
  pullRequest: { repoGithubId: number; number: number },
  status: TaskStatus,
) {
  return db
    .update(tasks)
    .set({ status })
    .where(
      and(
        eq(tasks.prNumber, pullRequest.number),
        inArray(
          tasks.projectId,
          db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.repoGithubId, pullRequest.repoGithubId)),
        ),
      ),
    )
    .returning({ id: tasks.id });
}

const ownedProjectIds = (db: Db, userId: string) =>
  db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

const projectColumns = {
  columns: { id: true, repoOwner: true, repoName: true },
} as const;

export async function findUserTasks(
  db: Db,
  userId: string,
  options: { projectId?: string; afterTaskId?: string; limit: number },
) {
  return db.query.tasks.findMany({
    where: and(
      inArray(tasks.projectId, ownedProjectIds(db, userId)),
      options.projectId ? eq(tasks.projectId, options.projectId) : undefined,
      options.afterTaskId
        ? sql`(${tasks.createdAt}, ${tasks.id}) < (select created_at, id from tasks where id = ${options.afterTaskId})`
        : undefined,
    ),
    with: {
      project: projectColumns,
      runs: { orderBy: desc(runs.queuedAt) },
    },
    orderBy: [desc(tasks.createdAt), desc(tasks.id)],
    limit: options.limit,
  });
}

export async function findUserTask(db: Db, userId: string, taskId: string) {
  return (
    (await db.query.tasks.findFirst({
      where: and(
        eq(tasks.id, taskId),
        inArray(tasks.projectId, ownedProjectIds(db, userId)),
      ),
      with: {
        project: projectColumns,
        messages: { orderBy: asc(messages.createdAt) },
        runs: {
          orderBy: desc(runs.queuedAt),
          with: { diff: { columns: { files: true, truncated: true } } },
        },
      },
    })) ?? null
  );
}

export type UserTaskListItem = Awaited<
  ReturnType<typeof findUserTasks>
>[number];
export type UserTask = NonNullable<Awaited<ReturnType<typeof findUserTask>>>;
