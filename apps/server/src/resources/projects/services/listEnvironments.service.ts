import { type Db, DbEnvironmentStore } from "@codegenie/db";
import type { EnvironmentResponse } from "@codegenie/shared";
import { toEnvironmentResponse } from "../projects.types";
import { getUserProject } from "./getUserProject.service";

/** A project's saved environment versions, newest first. */
export async function listEnvironments(
  db: Db,
  userId: string,
  projectId: string,
): Promise<EnvironmentResponse[]> {
  await getUserProject(db, userId, projectId);
  const versions = await new DbEnvironmentStore(db).list(projectId);
  return versions.map(toEnvironmentResponse);
}
