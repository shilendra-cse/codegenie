import { type Db, findUserTasks } from "@codegenie/db";
import type { TaskPage } from "@codegenie/shared";
import { toTaskListItem } from "../tasks.types";

const PAGE_SIZE = 50;

export async function listUserTasks(
  db: Db,
  userId: string,
  options: { projectId?: string; cursor?: string },
): Promise<TaskPage> {
  const rows = await findUserTasks(db, userId, {
    projectId: options.projectId,
    afterTaskId: options.cursor,
    limit: PAGE_SIZE + 1,
  });
  const page = rows.slice(0, PAGE_SIZE);
  return {
    tasks: page.map(toTaskListItem),
    nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
  };
}
