import type { Db } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import type { WorkQueue } from "../../tasks/tasks.types";
import { getRunnableProject } from "./getRunnableProject.service";

export async function startOnboarding(
  deps: { db: Db; queue: WorkQueue },
  userId: string,
  projectId: string,
): Promise<void> {
  await getRunnableProject(deps.db, userId, projectId);
  try {
    await deps.queue.add(
      "onboard-project",
      { projectId },
      { deduplication: { id: `onboard-${projectId}` } },
    );
  } catch {
    throw new HttpError(
      503,
      "CodeGenie can't take new work right now. Try again in a moment.",
      "QUEUE_UNAVAILABLE",
    );
  }
}
