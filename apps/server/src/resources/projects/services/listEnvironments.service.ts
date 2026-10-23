import { type Db, DbEnvironmentStore } from "@codegenie/db";
import type { EnvironmentResponse } from "@codegenie/shared";
import { getUserProject } from "./getUserProject.service";

/** A project's saved environment versions, newest (the active one) first. */
export async function listEnvironments(
  db: Db,
  userId: string,
  projectId: string,
): Promise<EnvironmentResponse[]> {
  await getUserProject(db, userId, projectId);
  const versions = await new DbEnvironmentStore(db).list(projectId);
  return versions.map((environment, index) => ({
    version: environment.version,
    active: index === 0,
    source: environment.source,
    savedAt: environment.savedAt,
    health: environment.health.status,
    healthReasons: environment.health.reasons,
    steps: environment.config.steps,
    checks: environment.config.checks,
    decisions: environment.config.meta.decisions,
  }));
}
