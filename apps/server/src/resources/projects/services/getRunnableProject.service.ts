import type { Db } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import type { ProjectResponse } from "@codegenie/shared";
import { getUserProject } from "./getUserProject.service";

export async function getRunnableProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<ProjectResponse> {
  const project = await getUserProject(db, userId, projectId);
  const { accountLogin, uninstalled, suspended } = project.installation;
  if (uninstalled) {
    throw new HttpError(
      409,
      `The CodeGenie GitHub App is no longer installed on ${accountLogin}.`,
      "GITHUB_INSTALLATION_REMOVED",
    );
  }
  if (suspended) {
    throw new HttpError(
      409,
      `The CodeGenie GitHub App is suspended on ${accountLogin}.`,
      "GITHUB_INSTALLATION_SUSPENDED",
    );
  }
  return project;
}
