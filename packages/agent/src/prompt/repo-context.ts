import { SandboxFileError } from "@codegenie/sandbox";
import { splitLines } from "../lib/lines.js";
import type { SetupResult } from "@codegenie/shared";
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

function describeInstall(install: SetupResult["install"]) {
  const took = `${(install.durationMs / 1000).toFixed(1)}s`;
  switch (install.status) {
    case "ok":
      return `succeeded (\`${install.command}\`, ${took})`;
    case "ok-after-retry":
      return `succeeded after retrying with \`${install.command}\` (${took}); the lockfile may be out of date`;
    case "skipped":
      return "skipped (nothing to install)";
    case "failed":
      return `FAILED (\`${install.command}\`). Full output: ${install.logPath}\nLast lines:\n${install.errorTail ?? "(no output)"}`;
  }
}

function describeSetup(ctx: ToolContext, setup?: SetupResult) {
  const lines: string[] = ["## Setup (done before you started)"];
  if (setup) {
    lines.push(`Package manager: ${setup.packageManager ?? "not detected"}`);
    lines.push(`Install: ${describeInstall(setup.install)}`);
  }
  lines.push(
    ctx.checks.length
      ? `Checks (run_checks):\n${ctx.checks.map((c) => `- ${c.name}: ${c.command}${c.cwd === "." ? "" : ` (in ${c.cwd})`}`).join("\n")}`
      : "Checks (run_checks): none detected.",
  );
  if (setup?.notes.length) {
    lines.push(`Notes:\n${setup.notes.map((n) => `- ${n}`).join("\n")}`);
  }
  return lines.join("\n");
}
