import type {
  CheckResult,
  EnvironmentProposal,
  StepResult,
  TryResult,
} from "@codegenie/shared";

const where = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? item.name : `${item.name} (${item.cwd})`;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const indent = (text: string) =>
  text
    .trimEnd()
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

const CHECK_LABEL: Record<CheckResult["status"], string> = {
  passing: "✓ passing",
  failing: "✗ failing",
  broken: "⚠ broken (the command could not run)",
  "timed-out": "⚠ timed out",
};

function stepLine(step: StepResult) {
  const mark = step.status === "ok" ? "✓" : "✗ FAILED";
  const time = step.reused ? "already done" : seconds(step.durationMs);
  return `${mark} ${where(step)}: ${step.command} (${time})`;
}

function checkLine(check: CheckResult) {
  return `${CHECK_LABEL[check.status]} ${where(check)}: ${check.command} (${seconds(check.durationMs)})`;
}

export function formatProposal(proposal: EnvironmentProposal) {
  return JSON.stringify(proposal, null, 2);
}

/** Every status first, then the output of what didn't work, so the overview is never cut off. */
export function formatTryResult(result: TryResult) {
  const lines = [
    "Steps:",
    ...(result.steps.length ? result.steps.map(stepLine) : ["(none)"]),
    "",
    "Checks:",
    ...(result.checks.length ? result.checks.map(checkLine) : ["(none)"]),
  ];
  const failedSteps = result.steps.filter((s) => s.status === "failed");
  const failedChecks = result.checks.filter((c) => c.status !== "passing");
  for (const step of failedSteps) {
    lines.push(
      "",
      `--- ${where(step)} (full log: ${step.logPath}) ---`,
      indent(step.errorTail ?? "(no output)"),
    );
  }
  for (const check of failedChecks) {
    lines.push(
      "",
      `--- ${where(check)} (full log: ${check.logPath}) ---`,
      indent(check.outputTail ?? "(no output)"),
    );
  }
  return lines.join("\n");
}
