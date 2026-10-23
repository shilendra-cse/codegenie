import {
  type Db,
  findUserProject,
  findUserProjectForRepo,
  getInstallation,
  upsertProject,
} from "@codegenie/db";
import { listInstallationRepos } from "@codegenie/github";
import { HttpError } from "@/lib/http-error";
import type { CreateProjectInput, ProjectResponse } from "@codegenie/shared";
import { toProjectResponse } from "../projects.types";

export type CreateProjectDeps = {
  db: Db;
  githubToken(userId: string): Promise<string | null>;
  fetch?: typeof fetch;
};

const installationNotFound = () =>
  new HttpError(
    404,
    "Installation not found.",
    "GITHUB_INSTALLATION_NOT_FOUND",
  );

export async function createProject(
  deps: CreateProjectDeps,
  userId: string,
  input: CreateProjectInput,
): Promise<{ project: ProjectResponse; created: boolean }> {
  const { db } = deps;
  const installation = await getInstallation(db, input.installationId);
  if (!installation || installation.uninstalledAt) throw installationNotFound();
  if (installation.suspendedAt) {
    throw new HttpError(
      409,
      `The CodeGenie GitHub App is suspended on ${installation.accountLogin}.`,
      "GITHUB_INSTALLATION_SUSPENDED",
    );
  }

  const token = await deps.githubToken(userId);
  if (!token) {
    throw new HttpError(
      401,
      "Sign in with GitHub again to continue.",
      "GITHUB_SIGN_IN_REQUIRED",
    );
  }
  const repos = await listInstallationRepos(token, input.installationId, {
    fetch: deps.fetch,
  });
  if (!repos) throw installationNotFound();
  const repo = repos.find((r) => r.id === input.repoId);
  if (!repo) {
    throw new HttpError(
      404,
      "Repository not found.",
      "GITHUB_REPOSITORY_NOT_FOUND",
    );
  }

  const existing = await findUserProjectForRepo(db, userId, repo.id);
  const { id } = await upsertProject(db, {
    userId,
    installationId: installation.id,
    repoGithubId: repo.id,
    repoOwner: repo.owner,
    repoName: repo.name,
    defaultBranch: repo.defaultBranch,
  });
  const project = await findUserProject(db, userId, id);
  return { project: toProjectResponse(project!), created: !existing };
}
