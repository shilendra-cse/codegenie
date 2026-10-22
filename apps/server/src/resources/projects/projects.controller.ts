import type { Db } from "@codegenie/db";
import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { projectParamsSchema } from "./projects.types";
import { getUserProject } from "./services/getUserProject.service";
import { listUserProjects } from "./services/listUserProjects.service";

export type ProjectControllerDeps = { db: Db };

export function createProjectControllers({ db }: ProjectControllerDeps) {
  const listProjects: AuthenticatedController = async (req) => {
    const projects = await listUserProjects(db, req.user.id);
    return ok(200, "OK", { projects });
  };

  const getProject: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const project = await getUserProject(db, req.user.id, id);
    return ok(200, "OK", { project });
  };

  return { listProjects, getProject };
}
