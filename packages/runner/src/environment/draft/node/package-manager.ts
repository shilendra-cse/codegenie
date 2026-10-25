import type { PackageManager } from "@hobai/shared";
import type { InstallPlan } from "../detector.js";
import type { PackageJson } from "./package-json.js";

const LOCKFILES: [file: string, manager: PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];

const MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

export type ManagerDetection = {
  manager: PackageManager;
  source: "packageManager field" | "lockfile" | "default";
  hasLockfile: boolean;
};

export async function detectPackageManager(
  pkg: PackageJson,
  has: (file: string) => Promise<boolean>,
): Promise<ManagerDetection> {
  let lockfileManager: PackageManager | null = null;
  for (const [file, manager] of LOCKFILES) {
    if (await has(file)) {
      lockfileManager = manager;
      break;
    }
  }

  const fromField = pkg.packageManager?.split("@")[0] as
    | PackageManager
    | undefined;
  if (fromField && MANAGERS.includes(fromField)) {
    return {
      manager: fromField,
      source: "packageManager field",
      hasLockfile: lockfileManager === fromField,
    };
  }
  if (lockfileManager) {
    return { manager: lockfileManager, source: "lockfile", hasLockfile: true };
  }
  return { manager: "npm", source: "default", hasLockfile: false };
}

export function installPlan(
  manager: PackageManager,
  hasLockfile: boolean,
): InstallPlan | null {
  switch (manager) {
    case "npm":
      return hasLockfile
        ? { frozen: "npm ci", fallback: "npm install" }
        : { frozen: "npm install", fallback: null };
    case "pnpm":
      return hasLockfile
        ? { frozen: "pnpm install --frozen-lockfile", fallback: "pnpm install" }
        : { frozen: "pnpm install", fallback: null };
    case "yarn":
      return hasLockfile
        ? { frozen: "yarn install --frozen-lockfile", fallback: "yarn install" }
        : { frozen: "yarn install", fallback: null };
    case "bun":
      return null;
  }
}
