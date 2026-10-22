import { type Db, findUserProjects } from "@codegenie/db";
import { type ProjectResponse, toProjectResponse } from "../projects.types";

export async function listUserProjects(
  db: Db,
  userId: string,
): Promise<ProjectResponse[]> {
  const projects = await findUserProjects(db, userId);
  return projects.map(toProjectResponse);
}
