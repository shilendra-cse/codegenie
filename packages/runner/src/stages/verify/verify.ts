import type { Sandbox } from "@codegenie/sandbox";
import type { Check, CheckResult } from "@codegenie/shared";
import { runChecks } from "../../environment/checks.js";
import { compareChecks, type ComparedCheck } from "./compare.js";

export type VerifyResult = {
  checks: ComparedCheck[];
  /** null when the repository has no checks. */
  passed: boolean | null;
  fixed: number;
  regressions: number;
};

export async function runVerify(
  sandbox: Sandbox,
  checks: Check[],
  baseline: CheckResult[] | null,
): Promise<VerifyResult> {
  const compared = compareChecks(
    baseline,
    await runChecks(sandbox, checks, "verify"),
  );
  return {
    checks: compared,
    passed: compared.length
      ? compared.every((check) => check.status === "passing")
      : null,
    fixed: compared.filter((c) => c.comparison === "fixed").length,
    regressions: compared.filter((c) => c.comparison === "regressed").length,
  };
}
