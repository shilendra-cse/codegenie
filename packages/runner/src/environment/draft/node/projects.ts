import path from "node:path";
import type { RepoReader } from "../repo-reader.js";
import type { PackageJson } from "./package-json.js";

export const MAX_PROJECTS = 8;

// A root that depends on nothing but these only runs or formats its sub-projects.
const ROOT_TOOLS = new Set([
  "concurrently",
  "npm-run-all",
  "npm-run-all2",
  "turbo",
  "nx",
  "lerna",
  "husky",
  "lint-staged",
  "prettier",
  "@commitlint/cli",
  "@commitlint/config-conventional",
  "cross-env",
  "rimraf",
]);

export type Layout = {
  /** Folders that get their own install, in order; "." is the root. */
  projects: string[];
  /** Packages of a root workspace; checked from their own folders, installed by the root. */
  workspacePackages: string[];
  notes: string[];
};

export function parsePnpmWorkspace(yaml: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
    } else if (inPackages) {
      const item = /^\s+-\s*["']?([^"'#\s]+)["']?/.exec(line);
      if (item) patterns.push(item[1]!);
      else if (/^\S/.test(line)) inPackages = false;
    }
  }
  return patterns;
}

async function workspacePatterns(repo: RepoReader, root: PackageJson) {
  const field = Array.isArray(root.workspaces)
    ? root.workspaces
    : root.workspaces?.packages;
  if (field) return field;
  const yaml = await repo.readText("pnpm-workspace.yaml");
  return yaml === null ? null : parsePnpmWorkspace(yaml);
}

async function packageFolders(repo: RepoReader, dir: string) {
  const folders: string[] = [];
  for (const entry of await repo.entries(dir)) {
    if (
      !entry.isDirectory ||
      entry.name === "node_modules" ||
      entry.name.startsWith(".")
    ) {
      continue;
    }
    const folder = path.posix.join(dir, entry.name);
    if (await repo.has(`${folder}/package.json`)) folders.push(folder);
  }
  return folders;
}

async function expandPatterns(
  repo: RepoReader,
  patterns: string[],
  notes: string[],
) {
  const packages: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;
    const clean = pattern.replace(/^\.\//, "").replace(/\/$/, "");
    if (/^[^*]+\/\*$/.test(clean)) {
      packages.push(...(await packageFolders(repo, clean.slice(0, -2))));
    } else if (!clean.includes("*")) {
      if (await repo.has(`${clean}/package.json`)) packages.push(clean);
    } else {
      notes.push(
        `Workspace pattern "${pattern}" is not supported; its packages were not checked.`,
      );
    }
  }
  return [...new Set(packages)];
}

function onlyRunsTools(root: PackageJson) {
  const dependencies = Object.keys(root.dependencies ?? {});
  const devDependencies = Object.keys(root.devDependencies ?? {});
  return (
    dependencies.length === 0 &&
    devDependencies.every((name) => ROOT_TOOLS.has(name))
  );
}

function limit(folders: string[], what: string, notes: string[]) {
  if (folders.length <= MAX_PROJECTS) return folders;
  notes.push(
    `Found ${folders.length} ${what}; only the first ${MAX_PROJECTS} are set up: ${folders.slice(0, MAX_PROJECTS).join(", ")}.`,
  );
  return folders.slice(0, MAX_PROJECTS);
}

/** Works out which folders of a Node repository are projects (one folder level deep). */
export async function findLayout(
  repo: RepoReader,
  root: PackageJson | null,
): Promise<Layout> {
  const notes: string[] = [];

  const patterns = root ? await workspacePatterns(repo, root) : null;
  if (patterns) {
    const packages = limit(
      await expandPatterns(repo, patterns, notes),
      "workspace packages",
      notes,
    );
    if (packages.length > 0) {
      notes.push(
        `Workspace with ${packages.length} package${packages.length === 1 ? "" : "s"}: ${packages.join(", ")}.`,
      );
    }
    return { projects: ["."], workspacePackages: packages, notes };
  }

  const folders = await packageFolders(repo, ".");
  if (folders.length === 0) {
    return { projects: root ? ["."] : [], workspacePackages: [], notes };
  }
  if (!root) {
    return {
      projects: limit(folders, "projects", notes),
      workspacePackages: [],
      notes,
    };
  }
  if (onlyRunsTools(root)) {
    notes.push(
      "The root package.json only runs the sub-projects; its scripts are skipped and each sub-project is set up on its own.",
    );
    return {
      projects: limit(folders, "projects", notes),
      workspacePackages: [],
      notes,
    };
  }
  return {
    projects: limit([".", ...folders], "projects", notes),
    workspacePackages: [],
    notes,
  };
}
