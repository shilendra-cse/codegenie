import type { UserProject } from "@codegenie/db";
import { z } from "zod";

export const projectParamsSchema = z.object({
  id: z.uuid("The project id must be a UUID."),
});

export const createProjectSchema = z.object({
  installationId: z.number().int().positive(),
  repoId: z.number().int().positive(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export type ProjectResponse = {
  id: string;
  repo: { githubId: number; owner: string; name: string };
  defaultBranch: string;
  environment: {
    version: number;
    health: "ok" | "needs_attention";
    healthReasons: string[];
    savedAt: string;
  } | null;
  installation: {
    accountLogin: string;
    suspended: boolean;
    uninstalled: boolean;
  };
  createdAt: string;
};

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
