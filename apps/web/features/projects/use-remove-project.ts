import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";

export async function removeProject(projectId: string) {
  await api.delete(`/projects/${projectId}`);
}

export const removeProjectErrorMessage = (error: unknown) =>
  error instanceof ApiError && error.code === "PROJECT_BUSY"
    ? "A task is still running in this project. Wait for it to finish, or cancel it, then remove the project."
    : "Couldn't remove the project. Try again.";

export function useRemoveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeProject,
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: ["projects", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
