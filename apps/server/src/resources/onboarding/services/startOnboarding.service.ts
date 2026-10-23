import { createOnboarding, type Db, markOnboardingEnded } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import { getRunnableProject } from "../../projects/services/getRunnableProject.service";
import type { WorkQueue } from "../../tasks/tasks.types";

/** Starts setup, or returns the one already in progress. */
export async function startOnboarding(
  deps: { db: Db; queue: WorkQueue },
  userId: string,
  projectId: string,
) {
  await getRunnableProject(deps.db, userId, projectId);
  const { onboarding, created } = await createOnboarding(deps.db, {
    projectId,
    userId,
  });
  if (!created) return onboarding;
  try {
    await deps.queue.add(
      "onboard-project",
      { onboardingId: onboarding.id },
      { jobId: onboarding.id },
    );
  } catch (error) {
    // Otherwise the queued row would block every later setup of this project.
    await markOnboardingEnded(deps.db, onboarding.id, {
      status: "failed",
      errorCode: "queue_unavailable",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError(
      503,
      "CodeGenie can't take new work right now. Try again in a moment.",
      "QUEUE_UNAVAILABLE",
    );
  }
  return onboarding;
}
