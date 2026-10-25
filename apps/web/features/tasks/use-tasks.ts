import type { CreateTaskInput, TaskListItem } from "@codegenie/shared";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchTask, fetchTaskPage, startTask, taskKey, tasksKey } from "./api";

const REFRESH_MS = 3_000;

export const isTaskActive = (task: TaskListItem | undefined) =>
  task?.label === "queued" || task?.label === "working";

/** Your latest tasks (the first page), across projects or for one; refreshed while any is running. */
export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: tasksKey(projectId),
    queryFn: () => fetchTaskPage(projectId ? { projectId } : {}),
    select: (page) => page.tasks,
    refetchInterval: (query) =>
      query.state.data?.tasks.some(isTaskActive) ? REFRESH_MS : false,
  });
}

export function useTaskCounts() {
  return useQuery({
    queryKey: tasksKey(),
    queryFn: () => fetchTaskPage(),
    select: (page) => page.counts,
    refetchInterval: (query) =>
      query.state.data && query.state.data.counts.running > 0
        ? REFRESH_MS
        : false,
  });
}

export function useHasTasks() {
  return useQuery({
    queryKey: tasksKey(),
    queryFn: () => fetchTaskPage(),
    select: (page) => page.tasks.length > 0,
  });
}

// Refreshed by its run's events (useRunEvents), not by polling.
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKey(id ?? ""),
    queryFn: id ? () => fetchTask(id) : skipToken,
  });
}

export function useStartTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => startTask(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
