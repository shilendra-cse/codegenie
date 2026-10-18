import type { Check } from "./setup.js";

export type EnvironmentSource = "detected" | "ai" | "user" | "mixed";

export type SetupStep = {
  name: string;
  cwd: string;
  command: string;
};

export type StepStatus = "ok" | "failed";
export type CheckStatus = "passing" | "failing" | "broken" | "timed-out";

export type EnvironmentDecision = {
  question: string;
  answer: string;
  auto: boolean;
};

export type EnvironmentConfig = {
  version: 1;
  steps: SetupStep[];
  checks: Check[];
  meta: {
    source: EnvironmentSource;
    createdAt: string;
    commit?: string;
    decisions: EnvironmentDecision[];
    validation?: {
      steps: Record<string, StepStatus>;
      checks: Record<string, CheckStatus>;
    };
  };
};

export type StepResult = SetupStep & {
  status: StepStatus;
  durationMs: number;
  logPath: string;
  errorTail?: string;
};

export type CheckResult = Check & {
  status: CheckStatus;
  durationMs: number;
  logPath: string;
  outputTail?: string;
};

export type EnvironmentHealth = "ok" | "needs_attention";

export type SetupResult = {
  config: EnvironmentConfig;
  steps: StepResult[];
  /** null when baseline checks were switched off. */
  baseline: CheckResult[] | null;
  /** Checks the agent and verify use: broken and timed-out ones removed. */
  checks: Check[];
  health: EnvironmentHealth;
  notes: string[];
};

/** Steps and checks without metadata: what the setup agent tries and proposes. */
export type EnvironmentProposal = {
  steps: SetupStep[];
  checks: Check[];
};

export type TryResult = {
  steps: StepResult[];
  checks: CheckResult[];
};

export type SetupQuestion = {
  question: string;
  why?: string;
  /** 2–4 options; the first one is recommended. */
  options: { label: string; detail?: string }[];
  /** false when only the listed options make sense (e.g. Save / Discard). */
  allowOther?: boolean;
};

/** `auto` marks answers picked without asking anyone (non-interactive runs). */
export type SetupAnswer = { option: number; auto?: boolean } | { other: string };

export interface UserChannel {
  ask(question: SetupQuestion): Promise<SetupAnswer>;
  info(message: string): void;
}

export function checkKey(check: Pick<Check, "name" | "cwd">) {
  return `${check.name}@${check.cwd}`;
}
