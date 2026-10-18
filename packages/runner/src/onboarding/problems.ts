import type { TryResult } from "@codegenie/shared";

const where = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? `"${item.name}"` : `"${item.name}" (${item.cwd})`;

const CHECK_PROBLEM = {
  failing: "is failing",
  broken: "could not run",
  "timed-out": "timed out",
} as const;

/** What the setup agent should look at; empty when the drafted setup simply works. */
export function findProblems(result: TryResult): string[] {
  if (result.steps.length === 0 && result.checks.length === 0) {
    return ["Nothing to install or check was detected."];
  }
  const problems = result.steps
    .filter((step) => step.status === "failed")
    .map((step) => `Setup step ${where(step)} failed.`);
  for (const check of result.checks) {
    if (check.status !== "passing") {
      problems.push(`Check ${where(check)} ${CHECK_PROBLEM[check.status]}.`);
    }
  }
  if (result.checks.length === 0) problems.push("No checks were found.");
  return problems;
}
