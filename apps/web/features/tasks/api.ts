import type {
  CreatedTask,
  CreateTaskInput,
  ListTasksQuery,
  TaskDetail,
  TaskPage,
} from "@codegenie/shared";
import { api } from "@/lib/api/client";

export const tasksKey = (projectId?: string) => [
  "tasks",
  "list",
  projectId ?? "all",
];
export const taskKey = (id: string) => ["tasks", id];

export async function fetchTaskPage(query: ListTasksQuery = {}) {
  const { data } = await api.get<TaskPage>("/tasks", { params: query });
  return data;
}

export async function fetchTask(id: string) {
  const { data } = await api.get<{ task: TaskDetail }>(`/tasks/${id}`);
  return data.task;
}

export async function startTask(projectId: string, input: CreateTaskInput) {
  const { data } = await api.post<CreatedTask>(
    `/projects/${projectId}/tasks`,
    input,
  );
  return data;
}
