// Result of preparing a repository before the agent runs (runner setup stage).
// Plain JSON: stored on projects.setup_config later and shown in the UI.

export const CHECK_NAMES = ["lint", "typecheck", "test", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

/** A command that verifies the repository, run by the agent's run_checks tool. */
export type Check = {
  name: CheckName;
  command: string;
  /** Directory relative to the workspace root. */
  cwd: string;
};

export type EcosystemId = "node";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type InstallStatus = "ok" | "ok-after-retry" | "failed" | "skipped";

export type InstallResult = {
  /** The last install command that ran; null when nothing was installed. */
  command: string | null;
  status: InstallStatus;
  durationMs: number;
  /** Full install output inside the sandbox. */
  logPath?: string;
  /** Last lines of output when the install failed. */
  errorTail?: string;
};

export type SetupResult = {
  /** null when no supported ecosystem was detected. */
  ecosystem: EcosystemId | null;
  packageManager: PackageManager | null;
  install: InstallResult;
  checks: Check[];
  /** Things the agent and the user should know, e.g. "bun is not available". */
  notes: string[];
};
