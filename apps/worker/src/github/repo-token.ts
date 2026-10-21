import { getInstallationById, type Db } from "@codegenie/db";
import type { GithubApp } from "@codegenie/github";

export class GithubAccessError extends Error {}

export type RepoProject = {
  installationId: string;
  repoGithubId: number;
  repoOwner: string;
  repoName: string;
};

export async function repoReadToken(
  deps: { db: Db; github: Pick<GithubApp, "repoToken"> },
  project: RepoProject,
): Promise<string> {
  const repo = `${project.repoOwner}/${project.repoName}`;
  const installation = await getInstallationById(
    deps.db,
    project.installationId,
  );
  if (!installation || installation.uninstalledAt) {
    throw new GithubAccessError(
      `The CodeGenie GitHub App is no longer installed for ${repo}.`,
    );
  }
  if (installation.suspendedAt) {
    throw new GithubAccessError(
      `The CodeGenie GitHub App is suspended on ${installation.accountLogin}.`,
    );
  }
  try {
    const { token } = await deps.github.repoToken(
      installation.installationId,
      project.repoGithubId,
      { contents: "read" },
    );
    return token;
  } catch (error) {
    throw new GithubAccessError(
      `GitHub refused access to ${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
