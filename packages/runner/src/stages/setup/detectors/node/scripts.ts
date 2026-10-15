import type { Check, PackageManager } from "@codegenie/shared";
import type { PackageJson } from "./package-json.js";

const TYPECHECK_SCRIPTS = ["typecheck", "type-check", "tsc", "check-types"];
/** npm init's default test script, which always fails. */
const NPM_PLACEHOLDER_TEST = /no test specified/;

/** Runs a local binary (e.g. tsc) with each package manager, without downloading it. */
const EXEC: Record<Exclude<PackageManager, "bun">, string> = {
  npm: "npx --no-install",
  pnpm: "pnpm exec",
  yarn: "yarn",
};

/**
 * Check commands from package.json scripts, run as `<pm> run <script>`.
 * TypeScript repos without a typecheck script get `tsc --noEmit`.
 */
export function detectChecks(
  pkg: PackageJson,
  manager: PackageManager,
  hasTsconfig: boolean,
): Check[] {
  const scripts = pkg.scripts ?? {};
  const run = (script: string) => `${manager} run ${script}`;
  const checks: Check[] = [];

  if (scripts.lint) {
    checks.push({ name: "lint", command: run("lint"), cwd: "." });
  }

  const typecheckScript = TYPECHECK_SCRIPTS.find((s) => scripts[s]);
  const hasTypescript = Boolean(
    pkg.dependencies?.typescript ?? pkg.devDependencies?.typescript,
  );
  if (typecheckScript) {
    checks.push({ name: "typecheck", command: run(typecheckScript), cwd: "." });
  } else if (hasTsconfig && hasTypescript && manager !== "bun") {
    checks.push({
      name: "typecheck",
      command: `${EXEC[manager]} tsc --noEmit`,
      cwd: ".",
    });
  }

  if (scripts.test && !NPM_PLACEHOLDER_TEST.test(scripts.test)) {
    checks.push({ name: "test", command: run("test"), cwd: "." });
  }

  if (scripts.build) {
    checks.push({ name: "build", command: run("build"), cwd: "." });
  }

  return checks;
}
