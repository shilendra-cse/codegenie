import { listRepoBranches } from "@codegenie/github";
import { HttpError } from "@/lib/http-error";
import type { BranchListResponse } from "@codegenie/shared";
import type { CreateProjectDeps } from "./createProject.service";
import { getUserProject } from "./getUserProject.service";

export async function listProjectBranches(
  deps: CreateProjectDeps,
  userId: string,
  projectId: string,
): Promise<BranchListResponse> {
  const project = await getUserProject(deps.db, userId, projectId);
  const token = await deps.githubToken(userId);
  if (!token) {
    throw new HttpError(
      401,
      "Sign in with GitHub again to continue.",
      "GITHUB_SIGN_IN_REQUIRED",
    );
  }
  const listed = await listRepoBranches(
    token,
    project.repo.owner,
    project.repo.name,
    { fetch: deps.fetch },
  );
  if (!listed) {
    throw new HttpError(
      404,
      "This repository is no longer available to CodeGenie.",
      "GITHUB_REPOSITORY_NOT_FOUND",
    );
  }
  const { defaultBranch } = project;
  return {
    branches: [
      defaultBranch,
      ...listed.names.filter((name) => name !== defaultBranch),
    ],
    defaultBranch,
    truncated: listed.truncated,
  };
}
