import {
  checkKey,
  type Check,
  type CheckResult,
  type EnvironmentConfig,
  type EnvironmentDecision,
  type EnvironmentSource,
  type StepResult,
} from "@codegenie/shared";
import { isUsable } from "./checks.js";

export function stepKey(step: { name: string; cwd: string }) {
  return `${step.name}@${step.cwd}`;
}

export function buildConfig(input: {
  steps: StepResult[];
  /** Checks to keep; broken and timed-out ones (per the results) are left out. */
  checks: Check[];
  results: CheckResult[] | null;
  source: EnvironmentSource;
  commit?: string;
  decisions?: EnvironmentDecision[];
}): EnvironmentConfig {
  const { steps, results, commit } = input;
  const statuses = new Map((results ?? []).map((c) => [checkKey(c), c.status]));
  const checks = input.checks.filter((check) => {
    const status = statuses.get(checkKey(check));
    return status === undefined || isUsable(status);
  });

  return {
    version: 1,
    steps: steps.map(({ name, cwd, command }) => ({ name, cwd, command })),
    checks,
    meta: {
      source: input.source,
      createdAt: new Date().toISOString(),
      ...(commit ? { commit } : {}),
      decisions: input.decisions ?? [],
      validation: {
        steps: Object.fromEntries(steps.map((s) => [stepKey(s), s.status])),
        checks: Object.fromEntries(
          (results ?? []).map((c) => [checkKey(c), c.status]),
        ),
      },
    },
  };
}
