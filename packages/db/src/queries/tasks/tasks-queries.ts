import { eq } from "drizzle-orm";
import type { Db } from "../../client.js";
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
  pullRequest: { number: number; url: string },
) {
  await db
    .update(tasks)
    .set({
      prNumber: pullRequest.number,
      prUrl: pullRequest.url,
      status: "pr_open",
    })
    .where(eq(tasks.id, taskId));
}
