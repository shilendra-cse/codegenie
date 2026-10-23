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

export type ProjectListResponse = { projects: ProjectResponse[] };
