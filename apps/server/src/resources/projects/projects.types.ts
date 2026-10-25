import type { DbStoredEnvironment, UserProject } from "@hobai/db";
import type { EnvironmentResponse, ProjectResponse } from "@hobai/shared";

export function toProjectResponse(project: UserProject): ProjectResponse {
  const environment = project.environments[0];
  const setup = project.onboardings[0];
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
      id: project.installation.installationId,
      accountLogin: project.installation.accountLogin,
      accountType: project.installation.accountType,
      suspended: project.installation.suspendedAt !== null,
      uninstalled: project.installation.uninstalledAt !== null,
    },
    setup: setup ? { id: setup.id, status: setup.status } : null,
    createdAt: project.createdAt.toISOString(),
  };
}

export function toEnvironmentResponse(
  environment: DbStoredEnvironment,
): EnvironmentResponse {
  return {
    version: environment.version,
    active: environment.active,
    source: environment.source,
    savedAt: environment.savedAt,
    health: environment.health.status,
    healthReasons: environment.health.reasons,
    steps: environment.config.steps,
    checks: environment.config.checks,
    decisions: environment.config.meta.decisions,
  };
}
