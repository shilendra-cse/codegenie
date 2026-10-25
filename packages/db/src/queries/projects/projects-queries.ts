import { and, desc, eq, exists, inArray, not } from "drizzle-orm";
import type { Db } from "../../client.js";
import { onboardings } from "../../schema/projects/onboardings-schema.js";
import { projectEnvironments } from "../../schema/projects/project-environments-schema.js";
import { projects } from "../../schema/projects/projects-schema.js";
import { runs } from "../../schema/runs/runs-schema.js";
import { tasks } from "../../schema/tasks/tasks-schema.js";

export type NewProject = typeof projects.$inferInsert;

export async function getProject(db: Db, projectId: string) {
  return (
    (await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })) ?? null
  );
}

/** One project per user and repository: an existing one gets the repository's current owner, name and branch. */
export async function upsertProject(db: Db, values: NewProject) {
  const repo = {
    repoOwner: values.repoOwner,
    repoName: values.repoName,
    defaultBranch: values.defaultBranch,
  };
  const [project] = await db
    .insert(projects)
    .values(values)
    .onConflictDoUpdate({
      target: [projects.userId, projects.repoGithubId],
      set: { ...repo, updatedAt: new Date() },
    })
    .returning();
  return project!;
}

const withContext = {
  installation: true,
  environments: {
    where: eq(projectEnvironments.status, "active"),
    columns: { config: false },
  },
  onboardings: {
    columns: { id: true, status: true },
    orderBy: desc(onboardings.queuedAt),
    limit: 1,
  },
} as const;

export async function findUserProjects(db: Db, userId: string) {
  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    with: withContext,
    orderBy: desc(projects.createdAt),
  });
}

export async function findUserProject(
  db: Db,
  userId: string,
  projectId: string,
) {
  return (
    (await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      with: withContext,
    })) ?? null
  );
}

export type UserProject = NonNullable<
  Awaited<ReturnType<typeof findUserProject>>
>;

export async function findUserProjectRepos(db: Db, userId: string) {
  return db
    .select({ id: projects.id, repoGithubId: projects.repoGithubId })
    .from(projects)
    .where(eq(projects.userId, userId));
}

export async function findUserProjectForRepo(
  db: Db,
  userId: string,
  repoGithubId: number,
) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.userId, userId), eq(projects.repoGithubId, repoGithubId)),
    );
  return project ?? null;
}

export async function deleteProjectUnlessBusy(db: Db, projectId: string) {
  const busy = db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(tasks, eq(runs.taskId, tasks.id))
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(runs.status, ["queued", "running"]),
      ),
    );
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), not(exists(busy))))
    .returning({ id: projects.id });
  return deleted.length > 0;
}
