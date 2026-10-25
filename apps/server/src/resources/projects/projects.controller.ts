import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import {
  createProjectSchema,
  environmentParamsSchema,
  projectParamsSchema,
} from "@hobai/shared";
import {
  createProject,
  type CreateProjectDeps,
} from "./services/createProject.service";
import { getUserProject } from "./services/getUserProject.service";
import { listUserProjects } from "./services/listUserProjects.service";
import { removeProject } from "./services/removeProject.service";
import { listEnvironments } from "./services/listEnvironments.service";
import { listProjectBranches } from "./services/listProjectBranches.service";
import { restoreEnvironment } from "./services/restoreEnvironment.service";

export type ProjectControllerDeps = CreateProjectDeps;

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

  const getEnvironments: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const environments = await listEnvironments(db, req.user.id, id);
    return ok(200, "OK", { environments });
  };

  const restoreVersion: AuthenticatedController = async (req) => {
    const { id, version } = environmentParamsSchema.parse(req.params);
    const environment = await restoreEnvironment(db, req.user.id, id, version);
    return ok(200, "Restored", { environment });
  };

  const getBranches: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    return ok(200, "OK", await listProjectBranches(deps, req.user.id, id));
  };

  return {
    listProjects,
    getProject,
    addProject,
    deleteProject,
    getEnvironments,
    restoreVersion,
    getBranches,
  };
}
