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

function formatStep(step: StepResult) {
  const line = `${step.status === "ok" ? "✓" : "✗ FAILED"} ${where(step)}: ${step.command} (${seconds(step.durationMs)})`;
  if (step.status === "ok") return line;
  return `${line}, full log: ${step.logPath}\n${indent(step.errorTail ?? "(no output)")}`;
}

function formatCheck(check: CheckResult) {
  const line = `${CHECK_LABEL[check.status]} ${where(check)}: ${check.command} (${seconds(check.durationMs)})`;
  if (check.status === "passing") return line;
  return `${line}, full log: ${check.logPath}\n${indent(check.outputTail ?? "(no output)")}`;
}

export function formatProposal(proposal: EnvironmentProposal) {
  return JSON.stringify(proposal, null, 2);
}

export function formatTryResult(result: TryResult) {
  return [
    "Steps:",
    ...(result.steps.length ? result.steps.map(formatStep) : ["(none)"]),
    "",
    "Checks:",
    ...(result.checks.length ? result.checks.map(formatCheck) : ["(none)"]),
  ].join("\n");
}
