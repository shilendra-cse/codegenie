import type { TaskCounts, TaskFilter } from "@hobai/shared";
import { and, asc, count, desc, eq, inArray, ne, not, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "../../client.js";
import type { Cycle } from "../billing/cycle.js";
import { countActiveRuns, countCycleRuns } from "../billing/usage-queries.js";
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
  return db.transaction((tx) => insertTaskWithRun(tx, values));
}

async function insertTaskWithRun(tx: DbOrTx, values: NewTaskWithRun) {
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
}

export type RunLimits = {
  userId: string;
  cycle: Cycle;
  /** null = no limit. */
  runsPerCycle: number | null;
  concurrentRuns: number;
};

/**
 * Like createTaskWithRun, unless the user already has as many runs going as their plan allows
 * (`concurrent`) or has used the cycle's runs (`cycle`).
 */
export async function createTaskWithinLimits(
  db: Db,
  values: NewTaskWithRun,
  limits: RunLimits,
) {
  return db.transaction(async (tx) => {
    // One start at a time per user, so two at once can't both pass the counts.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${limits.userId}))`,
    );
    if ((await countActiveRuns(tx, limits.userId)) >= limits.concurrentRuns) {
      return { refused: "concurrent" as const };
    }
    if (
      limits.runsPerCycle !== null &&
      (await countCycleRuns(tx, limits.userId, limits.cycle)) >=
        limits.runsPerCycle
    ) {
      return { refused: "cycle" as const };
    }
    return insertTaskWithRun(tx, values);
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

/** Sets the status of the task whose pull request this is; returns the tasks changed (none for a PR hobai didn't open). */
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

// The same order as the API's task label: a queued or running latest run comes before the pull request.
function taskFilterCondition(db: Db, filter: TaskFilter) {
  const latestStatus = db
    .select({ status: runs.status })
    .from(runs)
    .where(eq(runs.taskId, tasks.id))
    .orderBy(desc(runs.queuedAt))
    .limit(1);
  const active = sql`coalesce((${latestStatus}) in ('queued', 'running'), false)`;
  if (filter === "running") return active;
  return and(
    not(active),
    filter === "pr" ? eq(tasks.status, "pr_open") : ne(tasks.status, "pr_open"),
  )!;
}

const userTasksIn = (db: Db, userId: string, projectId?: string) =>
  and(
    inArray(tasks.projectId, ownedProjectIds(db, userId)),
    projectId ? eq(tasks.projectId, projectId) : undefined,
  );

export async function findUserTasks(
  db: Db,
  userId: string,
  options: {
    projectId?: string;
    filter?: TaskFilter;
    afterTaskId?: string;
    limit: number;
  },
) {
  return db.query.tasks.findMany({
    where: and(
      userTasksIn(db, userId, options.projectId),
      options.filter ? taskFilterCondition(db, options.filter) : undefined,
      options.afterTaskId
        ? sql`(${tasks.createdAt}, ${tasks.id}) < (select created_at, id from tasks where id = ${options.afterTaskId})`
        : undefined,
    ),
    with: {
      project: projectColumns,
      runs: {
        orderBy: desc(runs.queuedAt),
        with: { diff: { columns: { files: true } } },
      },
    },
    orderBy: [desc(tasks.createdAt), desc(tasks.id)],
    limit: options.limit,
  });
}

export async function countUserTasks(
  db: Db,
  userId: string,
  options: { projectId?: string } = {},
): Promise<TaskCounts> {
  const within = (filter: TaskFilter) =>
    sql`count(*) filter (where ${taskFilterCondition(db, filter)})`.mapWith(
      Number,
    );
  const [counts] = await db
    .select({
      all: count(),
      running: within("running"),
      pr: within("pr"),
      done: within("done"),
    })
    .from(tasks)
    .where(userTasksIn(db, userId, options.projectId));
  return counts!;
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
