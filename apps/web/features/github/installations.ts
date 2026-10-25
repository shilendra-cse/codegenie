import type { GitHubInstallationsResponse } from "@hobai/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export async function fetchInstallations() {
  const { data } = await api.get<GitHubInstallationsResponse>(
    "/github/installations",
  );
  return data;
}

export function useInstallations() {
  return useQuery({
    queryKey: ["github", "installations"],
    queryFn: fetchInstallations,
  });
}
