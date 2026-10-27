import type { Sandbox } from "@hobai/sandbox";
import type { Check, CheckResult } from "@hobai/shared";
import { runChecks } from "../../environment/checks.js";
import { compareChecks, type ComparedCheck } from "./compare.js";

export type VerifyResult = {
  checks: ComparedCheck[];
  /** Checks that never started because the run reached its time limit. */
  notRun?: Check[];
  /** null when the repository has no checks, or when every check that ran passed but some didn't run. */
  passed: boolean | null;
  fixed: number;
  regressions: number;
};

export async function runVerify(
  sandbox: Sandbox,
  checks: Check[],
  baseline: CheckResult[] | null,
  signal?: AbortSignal,
): Promise<VerifyResult> {
  const results = await runChecks(sandbox, checks, "verify", signal);
  const compared = compareChecks(baseline, results);
  const notRun = checks.slice(results.length);
  const allPassing = compared.every((check) => check.status === "passing");
  return {
    checks: compared,
    ...(notRun.length ? { notRun } : {}),
    passed: !allPassing
      ? false
      : notRun.length || !compared.length
        ? null
        : true,
    fixed: compared.filter((c) => c.comparison === "fixed").length,
    regressions: compared.filter((c) => c.comparison === "regressed").length,
  };
}
