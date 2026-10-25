import type { Sandbox } from "@hobai/sandbox";
import type { Check, StepResult, TryResult } from "@hobai/shared";
import { applySteps } from "../environment/apply.js";
import { runChecks } from "../environment/checks.js";
import type { DraftStep } from "../environment/draft/draft.js";

const stepKey = (step: { cwd: string; command: string }) =>
  `${step.cwd}\0${step.command}`;

/**
 * Tries setups in one sandbox, one attempt after another. Steps that already
 * succeeded with the same command in the same folder aren't run again: installs
 * take minutes and their results stay in the sandbox.
 */
export function createTryEnvironment(sandbox: Sandbox, logPrefix = "try") {
  const succeeded = new Map<string, StepResult>();
  let attempt = 0;

  return async (setup: {
    steps: DraftStep[];
    checks: Check[];
  }): Promise<TryResult> => {
    attempt += 1;
    const prefix = `${logPrefix}${attempt}`;
    const steps = await applySteps(sandbox, setup.steps, {
      logPrefix: `${prefix}-step`,
      reuse: (step) => {
        const done = succeeded.get(stepKey(step));
        return done && { ...done, name: step.name, reused: true };
      },
    });
    for (const step of steps) {
      if (step.status === "ok" && !step.reused) {
        succeeded.set(stepKey(step), step);
      }
    }
    const checks = await runChecks(sandbox, setup.checks, `${prefix}-check`);
    return { steps, checks };
  };
}
