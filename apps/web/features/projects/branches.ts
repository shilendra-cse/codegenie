import type { BranchListResponse } from "@codegenie/shared";
import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

const FIVE_MINUTES = 5 * 60_000;

export const branchesKey = (projectId: string) => [
  "projects",
  projectId,
  "branches",
];

export async function fetchBranches(projectId: string) {
  const { data } = await api.get<BranchListResponse>(
    `/projects/${projectId}/branches`,
  );
  return data;
}

/** The project's branches, asked for only once `enabled` (when the branch picker first opens). */
export function useBranches(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: branchesKey(projectId ?? ""),
    queryFn: projectId && enabled ? () => fetchBranches(projectId) : skipToken,
    staleTime: FIVE_MINUTES,
  });
}
