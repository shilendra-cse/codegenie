import { type Db, findOnboardingQuestion } from "@hobai/db";
import {
  ANSWER_CHANNEL,
  type AnswerOnboardingInput,
  type OnboardingAnswerMessage,
} from "@hobai/shared";
import { HttpError } from "@/lib/http-error";
import type { Publisher } from "../../runs/services/cancelRun.service";
import { toOnboardingQuestion } from "../onboarding.types";
import { getUserOnboarding } from "./getUserOnboarding.service";

const notOpen = () =>
  new HttpError(
    409,
    "That question isn't waiting for an answer any more.",
    "QUESTION_NOT_OPEN",
  );

/** Checks the answer against the open question, then hands it to the worker. */
export async function answerOnboarding(
  deps: { db: Db; publisher: Publisher },
  userId: string,
  projectId: string,
  { questionId, answer }: AnswerOnboardingInput,
): Promise<void> {
  const onboarding = await getUserOnboarding(deps.db, userId, projectId);
  if (
    onboarding.status !== "waiting" ||
    onboarding.openQuestionId !== questionId
  ) {
    throw notOpen();
  }
  const asked = await findOnboardingQuestion(
    deps.db,
    onboarding.id,
    questionId,
  );
  if (!asked) throw notOpen();
  const question = toOnboardingQuestion(asked);
  if ("option" in answer && answer.option >= question.options.length) {
    throw new HttpError(400, "That isn't one of the options.");
  }
  if ("other" in answer && !question.allowOther) {
    throw new HttpError(400, "Pick one of the options.");
  }

  const message: OnboardingAnswerMessage = {
    onboardingId: onboarding.id,
    questionId,
    answer,
  };
  await deps.publisher.publish(ANSWER_CHANNEL, JSON.stringify(message));
}
