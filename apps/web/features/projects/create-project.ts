import type { CreateProjectInput, ProjectResponse } from "@hobai/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { repositoriesKey } from "@/features/github/repositories";
import { api, ApiError } from "@/lib/api/client";

export async function createProject(input: CreateProjectInput) {
  const { data } = await api.post<{ project: ProjectResponse }>(
    "/projects",
    input,
  );
  return data.project;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (_project, { installationId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({
          queryKey: repositoriesKey(installationId),
        }),
      ]),
  });
}

export function addProjectError(error: unknown) {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "GITHUB_INSTALLATION_SUSPENDED":
      return "The GitHub App is suspended on this account.";
    case "GITHUB_REPOSITORY_NOT_FOUND":
    case "GITHUB_INSTALLATION_NOT_FOUND":
      return `This repository is no longer available to ${PRODUCT_NAME}.`;
    default:
      return error.message;
  }
}
