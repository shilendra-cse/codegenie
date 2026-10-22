import { type Db, findUserTask } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import { type TaskDetail, toTaskDetail } from "../tasks.types";

export async function getUserTask(
  db: Db,
  userId: string,
  taskId: string,
): Promise<TaskDetail> {
  const task = await findUserTask(db, userId, taskId);
  if (!task) throw new HttpError(404, "Task not found.", "TASK_NOT_FOUND");
  return toTaskDetail(task);
}
