import type {
  CheckResult,
  EnvironmentConfig,
  EnvironmentDecision,
  TryResult,
} from "@codegenie/shared";

const where = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? item.name : `${item.name} (${item.cwd})`;

const CHECK_MARK: Record<CheckResult["status"], string> = {
  passing: "✓",
  failing: "✗ failing",
  broken: "⚠ broken, left out",
  "timed-out": "⚠ timed out, left out",
};

/** The environment as shown before the user saves it. */
export function formatEnvironment(input: {
  config: EnvironmentConfig;
  final: TryResult;
  notes: string[];
  decisions: EnvironmentDecision[];
}) {
  const { final, notes, decisions } = input;
  const lines = ["", "Environment:", "  Steps:"];
  if (final.steps.length === 0) lines.push("    (none)");
  for (const step of final.steps) {
    lines.push(
      `    ${step.status === "ok" ? "✓" : "✗"} ${where(step)}: ${step.command}`,
    );
  }
  lines.push("  Checks:");
  if (final.checks.length === 0) lines.push("    (none)");
  for (const check of final.checks) {
    lines.push(
      `    ${CHECK_MARK[check.status]} ${where(check)}: ${check.command}`,
    );
  }
  if (notes.length) {
    lines.push("  Notes:", ...notes.map((n) => `    - ${n}`));
  }
  if (decisions.length) {
    lines.push(
      "  Answers:",
      ...decisions.map(
        (d) =>
          `    - ${d.question} → ${d.answer}${d.auto ? " (automatic)" : ""}`,
      ),
    );
  }
  return lines.join("\n");
}
