import {
  checkKey,
  type CheckComparison,
  type CheckResult,
  type CheckStatus,
} from "@hobai/shared";

export type { CheckComparison };

export type ComparedCheck = CheckResult & { comparison: CheckComparison };

export function compareCheck(
  before: CheckStatus | undefined,
  after: CheckStatus,
): CheckComparison {
  const passingAfter = after === "passing";
  if (before === undefined) return passingAfter ? "passing" : "failing";
  const passingBefore = before === "passing";
  if (passingAfter) return passingBefore ? "passing" : "fixed";
  return passingBefore ? "regressed" : "still-failing";
}

export function compareChecks(
  baseline: CheckResult[] | null,
  after: CheckResult[],
): ComparedCheck[] {
  const before = new Map((baseline ?? []).map((c) => [checkKey(c), c.status]));
  return after.map((check) => ({
    ...check,
    comparison: compareCheck(before.get(checkKey(check)), check.status),
  }));
}
