import type { GitHubReposResponse } from "@hobai/shared";
import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const repositoriesKey = (installationId: number | undefined) => [
  "github",
  "installations",
  installationId,
  "repositories",
];

export async function fetchRepositories(installationId: number) {
  const { data } = await api.get<GitHubReposResponse>(
    `/github/installations/${installationId}/repositories`,
  );
  return data.repositories;
}

export function useRepositories(installationId: number | undefined) {
  return useQuery({
    queryKey: repositoriesKey(installationId),
    queryFn:
      installationId === undefined
        ? skipToken
        : () => fetchRepositories(installationId),
  });
}
