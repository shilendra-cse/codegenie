import { checkKey, type SetupResult } from "@hobai/shared";
import { describeRepository } from "../../prompt/repository.js";
import type { ToolContext } from "../../tools/core/context.js";

export async function buildRepoContext(ctx: ToolContext, setup?: SetupResult) {
  return `${await describeRepository(ctx)}\n\n${describeSetup(ctx, setup)}`;
}

const STATUS_LABEL = {
  passing: "passing",
  failing: "already failing",
  broken: "broken",
  "timed-out": "timed out",
} as const;

function describeSteps(setup: SetupResult) {
  if (setup.steps.length === 0) return "Steps: none (nothing to install).";
  const lines = setup.steps.map((step) => {
    const where = step.cwd === "." ? "" : ` (in ${step.cwd})`;
    if (step.status === "ok")
      return `- ${step.name}${where}: \`${step.command}\` ✓`;
    return `- ${step.name}${where}: \`${step.command}\` FAILED. Full output: ${step.logPath}\n  Last lines:\n${step.errorTail ?? "(no output)"}`;
  });
  return `Steps:\n${lines.join("\n")}`;
}

function describeSetup(ctx: ToolContext, setup?: SetupResult) {
  const lines: string[] = ["## Setup (done before you started)"];
  if (setup) lines.push(describeSteps(setup));

  const baseline = new Map(
    (setup?.baseline ?? []).map((check) => [checkKey(check), check.status]),
  );
  if (ctx.checks.length === 0) {
    lines.push("Checks (run_checks): none detected.");
  } else {
    const heading = setup?.baseline
      ? "Checks (run_checks) and their status before your changes:"
      : "Checks (run_checks):";
    const checks = ctx.checks.map((check) => {
      const where = check.cwd === "." ? "" : ` (in ${check.cwd})`;
      const status = baseline.get(checkKey(check));
      return `- ${check.name}${where}: ${check.command}${status ? ` (${STATUS_LABEL[status]})` : ""}`;
    });
    lines.push(`${heading}\n${checks.join("\n")}`);
  }

  if (setup?.notes.length) {
    lines.push(`Notes:\n${setup.notes.map((n) => `- ${n}`).join("\n")}`);
  }
  if ([...baseline.values()].includes("failing")) {
    lines.push(
      "Don't try to fix checks that were already failing unless the task asks for it.",
    );
  }
  return lines.join("\n");
}
