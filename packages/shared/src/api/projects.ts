import { z } from "zod";
import type {
  EnvironmentDecision,
  EnvironmentHealth,
  EnvironmentSource,
  SetupStep,
} from "../types/environment.js";
import type { Check } from "../types/setup.js";

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

export type EnvironmentResponse = {
  version: number;
  /** The version new tasks use. */
  active: boolean;
  source: EnvironmentSource;
  savedAt: string;
  health: EnvironmentHealth;
  healthReasons: string[];
  steps: SetupStep[];
  checks: Check[];
  decisions: EnvironmentDecision[];
};

export type EnvironmentListResponse = { environments: EnvironmentResponse[] };
