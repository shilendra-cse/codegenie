import type { UserProject } from "@codegenie/db";
import type { ProjectResponse } from "@codegenie/shared";

export function toProjectResponse(project: UserProject): ProjectResponse {
  const environment = project.environments[0];
  return {
    id: project.id,
    repo: {
      githubId: project.repoGithubId,
      owner: project.repoOwner,
      name: project.repoName,
    },
    defaultBranch: project.defaultBranch,
    environment: environment
      ? {
          version: environment.version,
          health: environment.health,
          healthReasons: environment.healthReasons,
          savedAt: environment.createdAt.toISOString(),
        }
      : null,
    installation: {
      accountLogin: project.installation.accountLogin,
      suspended: project.installation.suspendedAt !== null,
      uninstalled: project.installation.uninstalledAt !== null,
    },
    createdAt: project.createdAt.toISOString(),
  };
}
