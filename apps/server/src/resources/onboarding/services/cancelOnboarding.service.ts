import { cancelQueuedOnboarding, type Db, findOnboarding } from "@hobai/db";
import { CANCEL_CHANNEL, type OnboardingCancelOutcome } from "@hobai/shared";
import { HttpError } from "@/lib/http-error";
import type { Publisher } from "../../runs/services/cancelRun.service";
import { getUserOnboarding } from "./getUserOnboarding.service";

export async function cancelOnboarding(
  deps: { db: Db; publisher: Publisher },
  userId: string,
  projectId: string,
): Promise<OnboardingCancelOutcome> {
  const onboarding = await getUserOnboarding(deps.db, userId, projectId);
  if (
    onboarding.status === "queued" &&
    (await cancelQueuedOnboarding(deps.db, onboarding.id))
  ) {
    return "cancelled";
  }
  // Read again: it may have started, or ended, since the first read.
  const current = await findOnboarding(deps.db, onboarding.id);
  if (current?.status !== "running" && current?.status !== "waiting") {
    throw new HttpError(
      409,
      "This setup has already ended.",
      "ONBOARDING_ENDED",
    );
  }
  await deps.publisher.publish(CANCEL_CHANNEL, onboarding.id);
  return "stopping";
}
