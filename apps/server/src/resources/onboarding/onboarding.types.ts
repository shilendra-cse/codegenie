import type { Onboarding } from "@codegenie/db";
import type { OnboardingQuestion, OnboardingResponse } from "@codegenie/shared";

/** A stored `question_asked` payload as the API shows it. */
export function toOnboardingQuestion(
  payload: Record<string, unknown>,
): OnboardingQuestion {
  const { questionId, question, why, options, allowOther } = payload as {
    questionId: string;
    question: string;
    why?: string;
    options: OnboardingQuestion["options"];
    allowOther: boolean;
  };
  return {
    id: questionId,
    question,
    ...(why ? { why } : {}),
    options,
    allowOther,
  };
}

export function toOnboardingResponse(
  onboarding: Onboarding & { environmentVersion?: number | null },
  question: OnboardingQuestion | null = null,
): OnboardingResponse {
  return {
    id: onboarding.id,
    status: onboarding.status,
    question,
    environmentVersion: onboarding.environmentVersion ?? null,
    error: onboarding.errorCode
      ? { code: onboarding.errorCode, message: onboarding.errorMessage }
      : null,
    inputTokens: onboarding.inputTokens,
    outputTokens: onboarding.outputTokens,
    costUsd: Number(onboarding.costUsd),
    queuedAt: onboarding.queuedAt.toISOString(),
    startedAt: onboarding.startedAt?.toISOString() ?? null,
    finishedAt: onboarding.finishedAt?.toISOString() ?? null,
    durationMs:
      onboarding.startedAt && onboarding.finishedAt
        ? onboarding.finishedAt.getTime() - onboarding.startedAt.getTime()
        : null,
  };
}
