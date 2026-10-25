import type { Db } from "@hobai/db";
import { HttpError } from "@/lib/http-error";
import type { ProjectResponse } from "@hobai/shared";
import { PRODUCT_NAME } from "@hobai/shared/brand";
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
      `The ${PRODUCT_NAME} GitHub App is no longer installed on ${accountLogin}.`,
      "GITHUB_INSTALLATION_REMOVED",
    );
  }
  if (suspended) {
    throw new HttpError(
      409,
      `The ${PRODUCT_NAME} GitHub App is suspended on ${accountLogin}.`,
      "GITHUB_INSTALLATION_SUSPENDED",
    );
  }
  return project;
}
