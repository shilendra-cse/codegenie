import {
  createTaskWithinLimits,
  type Db,
  ensureSubscription,
  markRunEnded,
  type Subscription,
} from "@hobai/db";
import { HttpError } from "@/lib/http-error";
import { getRunnableProject } from "../../projects/services/getRunnableProject.service";
import type { CreatedTask, CreateTaskInput } from "@hobai/shared";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { assertDailyCapacity } from "../../usage/services/assertDailyCapacity.service";
import type { WorkQueue } from "../tasks.types";

export type CreateTaskDeps = {
  db: Db;
  queue: WorkQueue;
  model: string;
  dailySpendCapUsd: number;
};

const TITLE_LENGTH = 120;

const resetDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function limitError(
  refused: "concurrent" | "cycle",
  { plan, periodEnd }: Subscription,
) {
  if (refused === "concurrent") {
    const running =
      plan.concurrentRuns === 1
        ? "a task running"
        : `${plan.concurrentRuns} tasks running`;
    return new HttpError(
      409,
      `You already have ${running}. Wait for it to finish, or cancel it.`,
      "RUN_IN_PROGRESS",
    );
  }
  return new HttpError(
    429,
    `You've used all ${plan.runsPerCycle} runs this cycle. They reset on ${resetDate(periodEnd)}.`,
    "RUN_LIMIT_REACHED",
    { resetsAt: periodEnd.toISOString() },
  );
}

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

  await assertDailyCapacity(deps.db, deps.dailySpendCapUsd);
  const subscription = await ensureSubscription(deps.db, userId);
  if (!subscription) throw new HttpError(401, "Sign in again.");

  const created = await createTaskWithinLimits(
    deps.db,
    {
      task: {
        projectId,
        createdByUserId: userId,
        title: input.prompt.split("\n")[0].trim().slice(0, TITLE_LENGTH),
        baseBranch: input.baseBranch ?? project.defaultBranch,
      },
      run: { trigger: "initial", model: deps.model },
      message: { authorUserId: userId, content: input.prompt },
    },
    {
      userId,
      cycle: { start: subscription.periodStart, end: subscription.periodEnd },
      runsPerCycle: subscription.plan.runsPerCycle,
      concurrentRuns: subscription.plan.concurrentRuns,
    },
  );
  if ("refused" in created) throw limitError(created.refused, subscription);
  const { task, run } = created;

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
      `${PRODUCT_NAME} can't take new work right now. Try again in a moment.`,
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
