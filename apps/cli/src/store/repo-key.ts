import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";
import type { RepoSource } from "@codegenie/runner";

const execFileAsync = promisify(execFile);

const URL_FORM = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i;
const SCP_FORM = /^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/;

/** "https://github.com/Acme/App.git", "git@github.com:acme/app" … → "github.com/acme/app". */
export function keyFromUrl(url: string): string | null {
  const match = URL_FORM.exec(url.trim()) ?? SCP_FORM.exec(url.trim());
  if (!match) return null;
  const repoPath = match[2]!
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .replace(/^\/+/, "");
  return `${match[1]!.toLowerCase()}/${repoPath.toLowerCase()}`;
}

async function git(dir: string, ...args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", dir, ...args]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Identifies a repository across commands: git URLs by host and path, local folders
 * by their origin remote (so a clone and its URL share one environment), or by
 * their path when they have none.
 */
export async function repoKey(source: RepoSource): Promise<string> {
  if (source.type === "git") return keyFromUrl(source.url) ?? source.url;
  const dir = await realpath(source.path);
  // A folder inside another repository must not borrow that repository's remote.
  const top = await git(dir, "rev-parse", "--show-toplevel");
  const remote =
    top && (await realpath(top)) === dir
      ? await git(dir, "remote", "get-url", "origin")
      : null;
  return (remote && keyFromUrl(remote)) ?? `local:${dir}`;
}
