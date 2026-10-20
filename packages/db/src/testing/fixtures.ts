import { randomInt, randomUUID } from "node:crypto";
import type { Db } from "../client.js";
import {
  githubInstallations,
  runs,
  projects,
  tasks,
  user,
} from "../schema/index.js";

type NewProject = Partial<typeof projects.$inferInsert>;

export async function insertProject(db: Db, values: NewProject = {}) {
  const userId = randomUUID();
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` });
  const [installation] = await db
    .insert(githubInstallations)
    .values({
      installationId: randomInt(1, 2 ** 31),
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      installationId: installation!.id,
      repoGithubId: randomInt(1, 2 ** 31),
      repoOwner: "acme",
      repoName: "app",
      defaultBranch: "main",
      ...values,
    })
    .returning();
  return project!;
}

export async function insertTask(
  db: Db,
  project: { id: string; userId: string },
  values: Partial<typeof tasks.$inferInsert> = {},
) {
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      createdByUserId: project.userId,
      title: "Add a /health endpoint",
      baseBranch: "main",
      ...values,
    })
    .returning();
  return task!;
}

export async function insertRun(
  db: Db,
  values: Partial<typeof runs.$inferInsert> = {},
) {
  const project = await insertProject(db);
  const task = await insertTask(db, project);
  const [run] = await db
    .insert(runs)
    .values({
      taskId: task.id,
      trigger: "initial",
      model: "test:scripted",
      ...values,
    })
    .returning();
  return { project, task, run: run! };
}
