import { getInstallationById, type Db } from "@hobai/db";
import type { GithubApp } from "@hobai/github";
import { PRODUCT_NAME } from "@hobai/shared/brand";

export class GithubAccessError extends Error {}

export type RepoProject = {
  installationId: string;
  repoGithubId: number;
  repoOwner: string;
  repoName: string;
};

/** The project's GitHub installation id, while the App is installed and not suspended. */
export async function repoInstallationId(
  db: Db,
  project: RepoProject,
): Promise<number> {
  const repo = `${project.repoOwner}/${project.repoName}`;
  const installation = await getInstallationById(db, project.installationId);
  if (!installation || installation.uninstalledAt) {
    throw new GithubAccessError(
      `The ${PRODUCT_NAME} GitHub App is no longer installed for ${repo}.`,
    );
  }
  if (installation.suspendedAt) {
    throw new GithubAccessError(
      `The ${PRODUCT_NAME} GitHub App is suspended on ${installation.accountLogin}.`,
    );
  }
  return installation.installationId;
}

export async function repoReadToken(
  deps: { db: Db; github: Pick<GithubApp, "repoToken"> },
  project: RepoProject,
): Promise<string> {
  const repo = `${project.repoOwner}/${project.repoName}`;
  const installationId = await repoInstallationId(deps.db, project);
  try {
    const { token } = await deps.github.repoToken(
      installationId,
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
