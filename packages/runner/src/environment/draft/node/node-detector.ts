import path from "node:path";
import type { Check } from "@hobai/shared";
import type { EcosystemDetector, Project } from "../detector.js";
import type { RepoReader } from "../repo-reader.js";
import type { PackageJson } from "./package-json.js";
import { detectPackageManager, installPlan } from "./package-manager.js";
import { findLayout } from "./projects.js";
import { detectChecks } from "./scripts.js";

const where = (dir: string) => (dir === "." ? "This repository" : dir);

async function readPackage(repo: RepoReader, dir: string, notes: string[]) {
  const file = path.posix.join(dir, "package.json");
  const read = await repo.readJson<PackageJson>(file);
  if (read.status === "invalid") {
    notes.push(
      `${file} is not valid JSON (${read.error}); its dependencies were not installed and no checks were detected.`,
    );
  }
  return read.status === "ok" ? read.value : null;
}

async function detectProject(
  repo: RepoReader,
  dir: string,
  root: PackageJson | null,
  workspacePackages: string[],
  notes: string[],
): Promise<Project> {
  const pkg = dir === "." ? root : await readPackage(repo, dir, notes);
  if (!pkg) {
    return { cwd: dir, packageManager: null, install: null, checks: [] };
  }

  const { manager, hasLockfile } = await detectPackageManager(
    { ...pkg, packageManager: pkg.packageManager ?? root?.packageManager },
    (file) => repo.has(path.posix.join(dir, file)),
  );
  if (manager === "bun") {
    notes.push(
      `${where(dir)} uses bun, which is not available in the sandbox; dependencies were not installed.`,
    );
  }

  const checksIn = async (folder: string, folderPkg: PackageJson) =>
    detectChecks(
      folderPkg,
      manager,
      await repo.has(path.posix.join(folder, "tsconfig.json")),
      folder,
    );

  const checks: Check[] = await checksIn(dir, pkg);
  if (checks.length === 0) {
    for (const packageDir of workspacePackages) {
      const packagePkg = await readPackage(repo, packageDir, notes);
      if (packagePkg) checks.push(...(await checksIn(packageDir, packagePkg)));
    }
  }
  if (checks.length === 0) {
    notes.push(
      `No lint, typecheck, test or build scripts were found in ${path.posix.join(dir, "package.json")}.`,
    );
  }

  return {
    cwd: dir,
    packageManager: manager,
    install: installPlan(manager, hasLockfile),
    checks,
  };
}

export const nodeDetector: EcosystemDetector = {
  id: "node",

  async detect(repo) {
    const notes: string[] = [];
    const rootRead = await repo.readJson<PackageJson>("package.json");
    if (rootRead.status === "invalid") {
      return {
        ecosystem: "node",
        projects: [],
        notes: [
          `package.json is not valid JSON (${rootRead.error}); dependencies were not installed and no checks were detected.`,
        ],
      };
    }
    const root = rootRead.status === "ok" ? rootRead.value : null;

    const layout = await findLayout(repo, root);
    if (layout.projects.length === 0) return null;
    notes.push(...layout.notes);

    const projects: Project[] = [];
    for (const dir of layout.projects) {
      projects.push(
        await detectProject(repo, dir, root, layout.workspacePackages, notes),
      );
    }
    return { ecosystem: "node", projects, notes };
  },
};
