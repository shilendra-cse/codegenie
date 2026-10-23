import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { createProjectSchema, projectParamsSchema } from "@codegenie/shared";
import {
  createProject,
  type CreateProjectDeps,
} from "./services/createProject.service";
import { getUserProject } from "./services/getUserProject.service";
import { listUserProjects } from "./services/listUserProjects.service";
import { removeProject } from "./services/removeProject.service";
import { startOnboarding } from "./services/startOnboarding.service";
import type { WorkQueue } from "../tasks/tasks.types";

export type ProjectControllerDeps = CreateProjectDeps & { queue: WorkQueue };

export function createProjectControllers(deps: ProjectControllerDeps) {
  const { db } = deps;

  const listProjects: AuthenticatedController = async (req) => {
    const projects = await listUserProjects(db, req.user.id);
    return ok(200, "OK", { projects });
  };

  const getProject: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const project = await getUserProject(db, req.user.id, id);
    return ok(200, "OK", { project });
  };

  const addProject: AuthenticatedController = async (req) => {
    const input = createProjectSchema.parse(req.body);
    const { project, created } = await createProject(deps, req.user.id, input);
    return created
      ? ok(201, "Created", { project })
      : ok(200, "OK", { project });
  };

  const deleteProject: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    await removeProject(db, req.user.id, id);
    return ok(200, "Deleted", { id });
  };

  const startSetup: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    await startOnboarding(deps, req.user.id, id);
    return ok(202, "Accepted", { projectId: id });
  };

  return { listProjects, getProject, addProject, deleteProject, startSetup };
}
