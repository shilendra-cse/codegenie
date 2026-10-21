import { eq } from "drizzle-orm";
import type { Db } from "../../client.js";
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
