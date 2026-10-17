import type { Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "../../lib/shell-quote.js";

export type FileChange = {
  path: string;
  added: number | null;
  removed: number | null;
};

export type Diff = {
  patch: string;
  truncated: boolean;
  files: FileChange[];
};

export function parseNumstat(numstat: string): FileChange[] {
  return numstat
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [added, removed, ...rest] = line.split("\t");
      return {
        path: rest.join("\t"),
        added: added === "-" ? null : Number(added),
        removed: removed === "-" ? null : Number(removed),
      };
    });
}

async function stageAll(sandbox: Sandbox) {
  const stage = await sandbox.exec("git add -A");
  if (stage.exitCode !== 0) {
    throw new Error(`Could not collect changes: ${stage.stderr.trim()}`);
  }
}

function pathspec(exclude: string[]) {
  if (exclude.length === 0) return "";
  return ` -- . ${exclude.map((p) => shellQuote(`:(exclude,literal)${p}`)).join(" ")}`;
}

export async function changedPaths(
  sandbox: Sandbox,
  baseline: string,
): Promise<string[]> {
  await stageAll(sandbox);
  const names = await sandbox.exec(
    `git diff --cached --name-only -z ${shellQuote(baseline)}`,
  );
  return names.stdout.split("\0").filter(Boolean);
}

export async function collectDiff(
  sandbox: Sandbox,
  baseline: string,
  exclude: string[] = [],
): Promise<Diff> {
  await stageAll(sandbox);
  const ref = shellQuote(baseline);
  const paths = pathspec(exclude);
  const numstat = await sandbox.exec(
    `git diff --cached --numstat ${ref}${paths}`,
  );
  const patch = await sandbox.exec(
    `git diff --cached --no-color ${ref}${paths}`,
  );
  return {
    patch: patch.stdout,
    truncated: patch.truncated,
    files: parseNumstat(numstat.stdout),
  };
}
