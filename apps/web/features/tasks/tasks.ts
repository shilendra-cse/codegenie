import type { ListTasksQuery, TaskPage } from "@codegenie/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export async function fetchTaskPage(query: ListTasksQuery = {}) {
  const { data } = await api.get<TaskPage>("/tasks", { params: query });
  return data;
}

export function useHasTasks() {
  return useQuery({
    queryKey: ["tasks", "first-page"],
    queryFn: () => fetchTaskPage(),
    select: (page) => page.tasks.length > 0,
  });
}
