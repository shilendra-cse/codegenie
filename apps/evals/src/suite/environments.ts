import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResolvedModel } from "@codegenie/agent";
import {
  autoChannel,
  parseEnvironmentConfig,
  runOnboarding,
} from "@codegenie/runner";
import type { EnvironmentConfig } from "@codegenie/shared";
import { pinCommit, repoSource, type EvalRepo } from "./repos.js";

export const environmentFile = (repo: EvalRepo) =>
  path.join(repo.dir, "environment.json");

async function readSaved(file: string) {
  try {
    return parseEnvironmentConfig(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** A saved environment made at another commit than the one now pinned can't be trusted. */
export function madeForOtherCommit(config: EnvironmentConfig, repo: EvalRepo) {
  if ("fixture" in repo) return false;
  return !config.meta.commit?.startsWith(repo.commit);
}

/**
 * The repository's saved environment, onboarding it first (with the recommended
 * answers) when there is none, it was made at another commit, or a refresh was asked for.
 */
export async function ensureEnvironment(
  repo: EvalRepo,
  options: {
    model: ResolvedModel;
    refresh?: boolean;
    log?: (message: string) => void;
    file?: string;
  },
): Promise<EnvironmentConfig> {
  const file = options.file ?? environmentFile(repo);
  const saved = options.refresh ? null : await readSaved(file);
  if (saved && !madeForOtherCommit(saved, repo)) return saved;

  options.log?.(
    saved
      ? `Onboarding ${repo.name} again: its environment was made at another commit…`
      : `Onboarding ${repo.name}…`,
  );
  const result = await runOnboarding({
    runId: `eval-onboard-${repo.name}`,
    source: repoSource(repo),
    model: options.model,
    channel: autoChannel(),
    afterCheckout: (sandbox) => pinCommit(sandbox, repo),
  });
  if (result.status !== "approved" || !result.config) {
    throw new Error(
      `Onboarding ${repo.name} ended ${result.status}${result.error ? `: ${result.error}` : ""}`,
    );
  }
  await writeFile(file, `${JSON.stringify(result.config, null, 2)}\n`);
  options.log?.(
    `Onboarded ${repo.name}; saved ${path.relative(process.cwd(), file)}`,
  );
  return result.config;
}
