import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { createTask, type CreateTaskDeps } from "./services/createTask.service";
import { getUserTask } from "./services/getUserTask.service";
import { listUserTasks } from "./services/listUserTasks.service";
import {
  createTaskSchema,
  listTasksQuerySchema,
  projectParamsSchema,
  taskParamsSchema,
} from "@hobai/shared";

export type TaskControllerDeps = CreateTaskDeps;

export function createTaskControllers(deps: TaskControllerDeps) {
  const { db } = deps;

  const startTask: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const input = createTaskSchema.parse(req.body);
    const created = await createTask(deps, req.user.id, id, input);
    return ok(201, "Created", created);
  };

  const listTasks: AuthenticatedController = async (req) => {
    const query = listTasksQuerySchema.parse(req.query);
    return ok(200, "OK", await listUserTasks(db, req.user.id, query));
  };

  const getTask: AuthenticatedController = async (req) => {
    const { id } = taskParamsSchema.parse(req.params);
    return ok(200, "OK", { task: await getUserTask(db, req.user.id, id) });
  };

  return { startTask, listTasks, getTask };
}
