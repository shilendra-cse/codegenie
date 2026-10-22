import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { projectParamsSchema } from "../projects/projects.types";
import { createTask, type CreateTaskDeps } from "./services/createTask.service";
import { createTaskSchema } from "./tasks.types";

export type TaskControllerDeps = CreateTaskDeps;

export function createTaskControllers(deps: TaskControllerDeps) {
  const startTask: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const input = createTaskSchema.parse(req.body);
    const created = await createTask(deps, req.user.id, id, input);
    return ok(201, "Created", created);
  };

  return { startTask };
}
