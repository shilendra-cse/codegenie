import { type Db, findOnboardingQuestion, findUserOnboarding } from "@hobai/db";
import type { OnboardingResponse } from "@hobai/shared";
import { getUserProject } from "../../projects/services/getUserProject.service";
import {
  toOnboardingQuestion,
  toOnboardingResponse,
} from "../onboarding.types";

/** The project's latest setup with its open question, or null before the first. */
export async function getLatestOnboarding(
  db: Db,
  userId: string,
  projectId: string,
): Promise<OnboardingResponse | null> {
  await getUserProject(db, userId, projectId);
  const onboarding = await findUserOnboarding(db, userId, projectId);
  if (!onboarding) return null;
  const asked =
    onboarding.status === "waiting" && onboarding.openQuestionId
      ? await findOnboardingQuestion(
          db,
          onboarding.id,
          onboarding.openQuestionId,
        )
      : null;
  return toOnboardingResponse(
    onboarding,
    asked ? toOnboardingQuestion(asked) : null,
  );
}
