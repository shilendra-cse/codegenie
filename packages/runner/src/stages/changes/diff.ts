import type { Sandbox } from "@hobai/sandbox";
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

export async function collectDiff(
  sandbox: Sandbox,
  baseline: string,
): Promise<Diff> {
  const stage = await sandbox.exec("git add -A");
  if (stage.exitCode !== 0) {
    throw new Error(`Could not collect changes: ${stage.stderr.trim()}`);
  }
  const ref = shellQuote(baseline);
  const numstat = await sandbox.exec(`git diff --cached --numstat ${ref}`);
  const patch = await sandbox.exec(`git diff --cached --no-color ${ref}`);
  return {
    patch: patch.stdout,
    truncated: patch.truncated,
    files: parseNumstat(numstat.stdout),
  };
}
