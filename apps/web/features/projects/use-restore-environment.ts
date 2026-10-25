import type { EnvironmentResponse } from "@codegenie/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";

export async function restoreEnvironment(projectId: string, version: number) {
  const { data } = await api.post<{ environment: EnvironmentResponse }>(
    `/projects/${projectId}/environments/${version}/restore`,
  );
  return data.environment;
}

export const restoreErrorMessage = (error: unknown, version: number) =>
  error instanceof ApiError && error.code === "SETUP_IN_PROGRESS"
    ? "Finish or stop the setup first."
    : `Couldn't restore v${version}. Try again.`;

export function useRestoreEnvironment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => restoreEnvironment(projectId, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
