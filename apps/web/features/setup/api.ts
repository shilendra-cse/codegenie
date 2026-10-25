import type {
  AnswerOnboardingInput,
  EnvironmentListResponse,
  OnboardingCancelOutcome,
  OnboardingResponse,
} from "@hobai/shared";
import { api } from "@/lib/api/client";

export const onboardingKey = (projectId: string) => [
  "projects",
  projectId,
  "onboarding",
];
export const environmentsKey = (projectId: string) => [
  "projects",
  projectId,
  "environments",
];

export async function fetchOnboarding(projectId: string) {
  const { data } = await api.get<{ onboarding: OnboardingResponse | null }>(
    `/projects/${projectId}/onboarding`,
  );
  return data.onboarding;
}

export async function startOnboarding(projectId: string) {
  const { data } = await api.post<{ onboarding: OnboardingResponse }>(
    `/projects/${projectId}/onboarding`,
  );
  return data.onboarding;
}

export async function answerOnboarding(
  projectId: string,
  input: AnswerOnboardingInput,
) {
  await api.post(`/projects/${projectId}/onboarding/answer`, input);
}

export async function cancelOnboarding(projectId: string) {
  const { data } = await api.post<{ outcome: OnboardingCancelOutcome }>(
    `/projects/${projectId}/onboarding/cancel`,
  );
  return data.outcome;
}

export async function fetchEnvironments(projectId: string) {
  const { data } = await api.get<EnvironmentListResponse>(
    `/projects/${projectId}/environments`,
  );
  return data.environments;
}

export const onboardingEventsUrl = (projectId: string) =>
  `/api/projects/${projectId}/onboarding/events`;
