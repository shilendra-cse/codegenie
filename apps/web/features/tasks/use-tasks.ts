import type { CreateTaskInput, TaskDetail } from "@codegenie/shared";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchTask, fetchTaskPage, startTask, taskKey, tasksKey } from "./api";

const REFRESH_MS = 3_000;

export const isTaskActive = (task: TaskDetail | undefined) =>
  task?.label === "queued" || task?.label === "working";

/** Your latest tasks (the first page), across projects or for one. */
export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: tasksKey(projectId),
    queryFn: () => fetchTaskPage(projectId ? { projectId } : {}),
    select: (page) => page.tasks,
  });
}

export function useHasTasks() {
  return useQuery({
    queryKey: tasksKey(),
    queryFn: () => fetchTaskPage(),
    select: (page) => page.tasks.length > 0,
  });
}

// Refreshed while its run is queued or working, until the live run view follows its events.
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKey(id ?? ""),
    queryFn: id ? () => fetchTask(id) : skipToken,
    refetchInterval: (query) =>
      isTaskActive(query.state.data) ? REFRESH_MS : false,
  });
}

export function useStartTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => startTask(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
