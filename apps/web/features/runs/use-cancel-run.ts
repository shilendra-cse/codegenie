import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskKey } from "@/features/tasks/api";
import { ApiError } from "@/lib/api/client";
import { cancelRun } from "./api";

async function cancelUnlessEnded(runId: string) {
  try {
    return await cancelRun(runId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "RUN_ENDED") return "ended";
    throw error;
  }
}

/** Cancels a task's run. A run that's working answers `stopping` and ends shortly after; its events say so. */
export function useCancelRun(taskId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: cancelUnlessEnded,
    onSuccess: async (outcome) => {
      if (outcome === "stopping") return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKey(taskId) }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "list"] }),
      ]);
    },
  });
  return {
    cancel: mutation.mutate,
    pending: mutation.isPending,
    stopping: mutation.data === "stopping",
    error: mutation.error,
  };
}
