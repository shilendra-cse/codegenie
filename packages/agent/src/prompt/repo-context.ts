import { SandboxFileError } from "@codegenie/sandbox";
import { splitLines } from "../lib/lines.js";
import { checkKey, type SetupResult } from "@codegenie/shared";
import type { ToolContext } from "../tools/core/context.js";
import { listFiles } from "../tools/list-files/list-files.js";

const README_LINES = 80;
const AGENTS_MD_CHARS = 8_000;
const MAX_DEPENDENCIES = 40;

async function readOptional(ctx: ToolContext, path: string) {
  try {
    return await ctx.sandbox.readFile(path);
  } catch (error) {
    if (error instanceof SandboxFileError) return null;
    throw error;
  }
}

async function firstExisting(ctx: ToolContext, paths: string[]) {
  for (const path of paths) {
    const content = await readOptional(ctx, path);
    if (content !== null) return { path, content };
  }
  return null;
}

function summarizePackageJson(raw: string) {
  try {
    const pkg = JSON.parse(raw) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const lines: string[] = [];
    if (pkg.name) lines.push(`name: ${pkg.name}`);
    const scripts = Object.entries(pkg.scripts ?? {});
    if (scripts.length) {
      lines.push("scripts:");
      for (const [name, command] of scripts)
        lines.push(`  ${name}: ${command}`);
    }
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    if (deps.length)
      lines.push(`dependencies: ${deps.slice(0, MAX_DEPENDENCIES).join(", ")}`);
    if (devDeps.length)
      lines.push(
        `devDependencies: ${devDeps.slice(0, MAX_DEPENDENCIES).join(", ")}`,
      );
    return lines.join("\n");
  } catch {
    return "(package.json could not be parsed)";
  }
}

export async function buildRepoContext(ctx: ToolContext, setup?: SetupResult) {
  const sections: string[] = [];

  sections.push(
    `## Files (2 levels)\n${await listFiles(ctx, { path: ".", depth: 2 })}`,
  );

  const pkg = await readOptional(ctx, "package.json");
  if (pkg !== null) {
    sections.push(`## package.json\n${summarizePackageJson(pkg)}`);
  }

  const readme = await firstExisting(ctx, ["README.md", "readme.md", "README"]);
  if (readme) {
    const lines = splitLines(readme.content);
    const excerpt = lines.slice(0, README_LINES).join("\n");
    const more =
      lines.length > README_LINES
        ? `\n… (${lines.length - README_LINES} more lines; read ${readme.path} for the rest)`
        : "";
    sections.push(`## ${readme.path} (excerpt)\n${excerpt}${more}`);
  }

  const agentsMd = await readOptional(ctx, "AGENTS.md");
  if (agentsMd !== null) {
    const text =
      agentsMd.length > AGENTS_MD_CHARS
        ? `${agentsMd.slice(0, AGENTS_MD_CHARS)}\n… (truncated; read AGENTS.md for the rest)`
        : agentsMd;
    sections.push(
      `## AGENTS.md (instructions from the repository owners)\n${text}`,
    );
  }

  sections.push(describeSetup(ctx, setup));

  return sections.join("\n\n");
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
