import { type Db, findUserProjects } from "@hobai/db";
import type { ProjectResponse } from "@hobai/shared";
import { toProjectResponse } from "../projects.types";

export async function listUserProjects(
  db: Db,
  userId: string,
): Promise<ProjectResponse[]> {
  const projects = await findUserProjects(db, userId);
  return projects.map(toProjectResponse);
}
