import type { EcosystemDetector } from "../../core/detector.js";
import type { PackageJson } from "./package-json.js";
import { detectPackageManager, installPlan } from "./package-manager.js";
import { detectChecks } from "./scripts.js";

/** JavaScript / TypeScript projects: anything with a package.json in the root. */
export const nodeDetector: EcosystemDetector = {
  id: "node",

  async detect(repo) {
    const pkg = await repo.readJson<PackageJson>("package.json");
    if (pkg.status === "missing") return null;

    if (pkg.status === "invalid") {
      return {
        ecosystem: "node",
        packageManager: null,
        install: null,
        checks: [],
        notes: [
          `package.json is not valid JSON (${pkg.error}); dependencies were not installed and no checks were detected.`,
        ],
      };
    }

    const notes: string[] = [];
    const { manager, hasLockfile } = await detectPackageManager(
      pkg.value,
      (name) => repo.hasRootEntry(name),
    );
    const install = installPlan(manager, hasLockfile);
    if (manager === "bun") {
      notes.push(
        "This repository uses bun, which is not available in the sandbox; dependencies were not installed.",
      );
    }

    const checks = detectChecks(
      pkg.value,
      manager,
      await repo.hasRootEntry("tsconfig.json"),
    );
    if (checks.length === 0) {
      notes.push(
        "No lint, typecheck, test or build scripts were found in package.json.",
      );
    }

    return {
      ecosystem: "node",
      packageManager: manager,
      install,
      checks,
      notes,
    };
  },
};
