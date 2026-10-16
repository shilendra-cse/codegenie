export const CHECK_NAMES = ["lint", "typecheck", "test", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

export type Check = {
  name: CheckName;
  command: string;
  cwd: string;
};

export type EcosystemId = "node";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type InstallStatus = "ok" | "ok-after-retry" | "failed" | "skipped";

export type InstallResult = {
  command: string | null;
  status: InstallStatus;
  durationMs: number;
  logPath?: string;
  errorTail?: string;
};

export type SetupResult = {
  ecosystem: EcosystemId | null;
  packageManager: PackageManager | null;
  install: InstallResult;
  checks: Check[];
  notes: string[];
};
