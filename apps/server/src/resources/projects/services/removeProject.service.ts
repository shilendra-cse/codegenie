import { type Db, deleteProjectUnlessBusy } from "@hobai/db";
import { HttpError } from "@/lib/http-error";
import { getUserProject } from "./getUserProject.service";

export async function removeProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<void> {
  await getUserProject(db, userId, projectId);
  if (!(await deleteProjectUnlessBusy(db, projectId))) {
    throw new HttpError(
      409,
      "A task is still running on this project. Cancel it first.",
      "PROJECT_BUSY",
    );
  }
}
