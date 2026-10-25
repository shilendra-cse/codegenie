import type { ProjectListResponse, ProjectResponse } from "@codegenie/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export async function fetchProjects() {
  const { data } = await api.get<ProjectListResponse>("/projects");
  return data.projects;
}

const REFRESH_MS = 3_000;
const SETTING_UP = new Set(["queued", "running", "waiting"]);

export const isSettingUp = ({ setup }: ProjectResponse) =>
  setup !== null && SETTING_UP.has(setup.status);

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    refetchInterval: (query) =>
      query.state.data?.some(isSettingUp) ? REFRESH_MS : false,
  });
}

export function toSidebarProject({ id, repo, environment }: ProjectResponse) {
  const health = !environment
    ? "none"
    : environment.health === "ok"
      ? "ok"
      : "attention";
  return { id, name: repo.name, health } as const;
}

export function useProject(id: string) {
  const projects = useProjects();
  return {
    project: projects.data?.find((project) => project.id === id),
    isPending: projects.isPending,
    isError: projects.isError,
    refetch: projects.refetch,
  };
}
