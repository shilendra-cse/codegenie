import type {
  AnswerOnboardingInput,
  OnboardingResponse,
} from "@codegenie/shared";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  answerOnboarding,
  cancelOnboarding,
  environmentsKey,
  fetchEnvironments,
  fetchOnboarding,
  onboardingKey,
  startOnboarding,
} from "./api";

const ENDED = new Set(["succeeded", "failed", "cancelled"]);

export const isSetupActive = (
  onboarding: OnboardingResponse | null | undefined,
) => Boolean(onboarding && !ENDED.has(onboarding.status));

export function useOnboarding(projectId: string | undefined) {
  return useQuery({
    queryKey: onboardingKey(projectId ?? ""),
    queryFn: projectId ? () => fetchOnboarding(projectId) : skipToken,
  });
}

export function useEnvironments(projectId: string | undefined) {
  return useQuery({
    queryKey: environmentsKey(projectId ?? ""),
    queryFn: projectId ? () => fetchEnvironments(projectId) : skipToken,
  });
}

export function useStartOnboarding(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startOnboarding(projectId),
    onSuccess: (onboarding) =>
      queryClient.setQueryData(onboardingKey(projectId), onboarding),
  });
}

export function useAnswerOnboarding(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnswerOnboardingInput) =>
      answerOnboarding(projectId, input),
    // The worker carries on as soon as the answer arrives.
    onSuccess: () =>
      queryClient.setQueryData<OnboardingResponse | null>(
        onboardingKey(projectId),
        (onboarding) =>
          onboarding && { ...onboarding, status: "running", question: null },
      ),
  });
}

export function useCancelOnboarding(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelOnboarding(projectId),
    onSuccess: (outcome) => {
      // A running setup ends shortly after; its events say so.
      if (outcome !== "cancelled") return;
      queryClient.setQueryData<OnboardingResponse | null>(
        onboardingKey(projectId),
        (onboarding) => onboarding && { ...onboarding, status: "cancelled" },
      );
    },
  });
}
