import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { projectEnvironments } from "../../schema/projects/project-environments-schema.js";
import { projects } from "../../schema/projects/projects-schema.js";

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
