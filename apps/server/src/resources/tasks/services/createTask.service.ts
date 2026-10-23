import { createTaskWithRun, type Db, markRunEnded } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import { getRunnableProject } from "../../projects/services/getRunnableProject.service";
import type { CreatedTask, CreateTaskInput } from "@codegenie/shared";
import type { WorkQueue } from "../tasks.types";

export type CreateTaskDeps = { db: Db; queue: WorkQueue; model: string };

const TITLE_LENGTH = 120;

export async function createTask(
  deps: CreateTaskDeps,
  userId: string,
  projectId: string,
  input: CreateTaskInput,
): Promise<CreatedTask> {
  const project = await getRunnableProject(deps.db, userId, projectId);
  if (!project.environment) {
    throw new HttpError(
      409,
      "Set up this project's environment first.",
      "PROJECT_NOT_SET_UP",
    );
  }
  if (project.environment.health === "needs_attention") {
    throw new HttpError(
      409,
      "This project's setup needs attention. Re-run setup first.",
      "PROJECT_NEEDS_ATTENTION",
    );
  }

  const { task, run } = await createTaskWithRun(deps.db, {
    task: {
      projectId,
      createdByUserId: userId,
      title: input.prompt.split("\n")[0].trim().slice(0, TITLE_LENGTH),
      baseBranch: input.baseBranch ?? project.defaultBranch,
    },
    run: { trigger: "initial", model: deps.model },
    message: { authorUserId: userId, content: input.prompt },
  });

  try {
    await deps.queue.add("run-task", { runId: run.id }, { jobId: run.id });
  } catch (error) {
    await markRunEnded(
      deps.db,
      run.id,
      {
        status: "failed",
        errorCode: "queue_unavailable",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      ["queued"],
    );
    throw new HttpError(
      503,
      "CodeGenie can't take new work right now. Try again in a moment.",
      "QUEUE_UNAVAILABLE",
    );
  }

  return {
    task: {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      baseBranch: task.baseBranch,
      createdAt: task.createdAt.toISOString(),
    },
    run: { id: run.id, status: "queued", model: run.model },
  };
}
