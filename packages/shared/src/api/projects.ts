import { z } from "zod";
import type {
  EnvironmentDecision,
  EnvironmentHealth,
  EnvironmentSource,
  SetupStep,
} from "../types/environment";
import type { Check } from "../types/setup";
import type { OnboardingState } from "./onboarding";

export const projectParamsSchema = z.object({
  id: z.uuid("The project id must be a UUID."),
});

export const environmentParamsSchema = projectParamsSchema.extend({
  version: z.coerce
    .number("The version must be a number.")
    .int("The version must be a whole number.")
    .positive("The version must be positive."),
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
    id: number;
    accountLogin: string;
    accountType: "user" | "organization";
    suspended: boolean;
    uninstalled: boolean;
  };
  setup: { id: string; status: OnboardingState } | null;
  createdAt: string;
};

export type ProjectListResponse = { projects: ProjectResponse[] };

export type BranchListResponse = {
  /** Branch names, the default branch first. */
  branches: string[];
  defaultBranch: string;
  /** More branches exist than were listed. */
  truncated: boolean;
};

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
