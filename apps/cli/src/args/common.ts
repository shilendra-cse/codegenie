import path from "node:path";
import type { RepoSource } from "@hobai/runner";

export class UsageError extends Error {}

const GIT_URL = /^(https?:\/\/|ssh:\/\/|git@)/;

export function parseSource(
  repo: string | undefined,
  ref: string | undefined,
  cwd: string,
): RepoSource {
  if (!repo) throw new UsageError("--repo is required");
  if (GIT_URL.test(repo)) {
    return { type: "git", url: repo, ...(ref ? { ref } : {}) };
  }
  if (ref) throw new UsageError("--ref only applies to git URLs");
  return { type: "local", path: path.resolve(cwd, repo) };
}

export function positiveNumber(flag: string, value: string | undefined) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new UsageError(`${flag} must be a positive number`);
  }
  return number;
}

export function usageError(error: unknown) {
  return new UsageError(error instanceof Error ? error.message : String(error));
}
