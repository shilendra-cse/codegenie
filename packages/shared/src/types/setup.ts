export const CHECK_NAMES = ["lint", "typecheck", "test", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

export type Check = {
  name: CheckName;
  command: string;
  cwd: string;
};

export type EcosystemId = "node";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
