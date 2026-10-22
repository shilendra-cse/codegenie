import { type Db, findUserProject } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import { type ProjectResponse, toProjectResponse } from "../projects.types";

export async function getUserProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<ProjectResponse> {
  const project = await findUserProject(db, userId, projectId);
  if (!project) {
    throw new HttpError(404, "Project not found.", "PROJECT_NOT_FOUND");
  }
  return toProjectResponse(project);
}
