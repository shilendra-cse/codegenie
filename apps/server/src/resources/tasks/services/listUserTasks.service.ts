import { countUserTasks, type Db, findUserTasks } from "@hobai/db";
import type { TaskFilter, TaskPage } from "@hobai/shared";
import { toTaskListItem } from "../tasks.types";

const PAGE_SIZE = 50;

export async function listUserTasks(
  db: Db,
  userId: string,
  options: { projectId?: string; filter?: TaskFilter; cursor?: string },
): Promise<TaskPage> {
  const [rows, counts] = await Promise.all([
    findUserTasks(db, userId, {
      projectId: options.projectId,
      filter: options.filter,
      afterTaskId: options.cursor,
      limit: PAGE_SIZE + 1,
    }),
    countUserTasks(db, userId, { projectId: options.projectId }),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  return {
    tasks: page.map(toTaskListItem),
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    counts,
  };
}
