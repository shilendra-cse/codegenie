import { useQueries } from "@tanstack/react-query";
import { fetchOnboarding, onboardingKey } from "@/features/setup/api";
import { useProjects } from "./projects";

export function useSetupsNeedingYou() {
  const waiting = (useProjects().data ?? []).filter(
    (project) => project.setup?.status === "waiting",
  );
  return useQueries({
    queries: waiting.map((project) => ({
      queryKey: onboardingKey(project.id),
      queryFn: () => fetchOnboarding(project.id),
    })),
    combine: (results) =>
      waiting.map((project, i) => ({
        project,
        onboarding: results[i]?.data ?? null,
      })),
  });
}
