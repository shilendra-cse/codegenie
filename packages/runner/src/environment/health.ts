import path from "node:path";
import type { Sandbox } from "@codegenie/sandbox";
import type { EnvironmentConfig } from "@codegenie/shared";
import type { PackageJson } from "./draft/node/package-json.js";
import { findLayout } from "./draft/node/projects.js";
import { RepoReader } from "./draft/repo-reader.js";

const folder = (cwd: string) => path.posix.normalize(cwd).replace(/\/$/, "");

/**
 * Project folders the rules would set up today that the saved environment has no
 * step or check for, e.g. a sub-project added after onboarding. Workspace packages
 * are installed by the root, so they never count.
 */
export async function uncoveredProjects(
  sandbox: Sandbox,
  config: EnvironmentConfig,
): Promise<string[]> {
  const repo = new RepoReader(sandbox);
  const root = await repo.readJson<PackageJson>("package.json");
  if (root.status === "invalid") return [];
  const layout = await findLayout(
    repo,
    root.status === "ok" ? root.value : null,
  );
  const covered = new Set(
    [...config.steps, ...config.checks].map((item) => folder(item.cwd)),
  );
  return layout.projects.filter((dir) => !covered.has(folder(dir)));
}
