import type { ProjectListResponse } from "@codegenie/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export async function fetchProjects() {
  const { data } = await api.get<ProjectListResponse>("/projects");
  return data.projects;
}

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
}
