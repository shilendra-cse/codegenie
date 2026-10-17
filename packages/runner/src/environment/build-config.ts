import {
  checkKey,
  type CheckResult,
  type EnvironmentConfig,
  type StepResult,
} from "@codegenie/shared";
import { isUsable } from "./checks.js";
import type { Draft } from "./draft/draft.js";

export function stepKey(step: { name: string; cwd: string }) {
  return `${step.name}@${step.cwd}`;
}

export function buildConfig(input: {
  draft: Draft;
  steps: StepResult[];
  baseline: CheckResult[] | null;
  commit?: string;
}): EnvironmentConfig {
  const { draft, steps, baseline, commit } = input;
  const statuses = new Map(
    (baseline ?? []).map((c) => [checkKey(c), c.status]),
  );
  const checks = draft.checks.filter((check) => {
    const status = statuses.get(checkKey(check));
    return status === undefined || isUsable(status);
  });

  return {
    version: 1,
    steps: steps.map(({ name, cwd, command }) => ({ name, cwd, command })),
    checks,
    meta: {
      source: draft.overridden ? "mixed" : "detected",
      createdAt: new Date().toISOString(),
      ...(commit ? { commit } : {}),
      decisions: [],
      validation: {
        steps: Object.fromEntries(steps.map((s) => [stepKey(s), s.status])),
        checks: Object.fromEntries(
          (baseline ?? []).map((c) => [checkKey(c), c.status]),
        ),
      },
    },
  };
}
