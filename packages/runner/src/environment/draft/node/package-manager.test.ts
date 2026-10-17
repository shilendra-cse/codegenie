import { describe, expect, it } from "vitest";
import { detectPackageManager, installPlan } from "./package-manager.js";

const has =
  (...files: string[]) =>
  async (name: string) =>
    files.includes(name);

describe("detectPackageManager", () => {
  it("prefers the packageManager field", async () => {
    expect(
      await detectPackageManager(
        { packageManager: "pnpm@10.18.1" },
        has("pnpm-lock.yaml"),
      ),
    ).toEqual({
      manager: "pnpm",
      source: "packageManager field",
      hasLockfile: true,
    });
  });

  it("notices when the lockfile belongs to a different manager than the field", async () => {
    expect(
      await detectPackageManager(
        { packageManager: "pnpm@10" },
        has("package-lock.json"),
      ),
    ).toEqual({
      manager: "pnpm",
      source: "packageManager field",
      hasLockfile: false,
    });
  });

  it("falls back to the lockfile", async () => {
    const cases: [string, string][] = [
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["package-lock.json", "npm"],
      ["npm-shrinkwrap.json", "npm"],
      ["bun.lock", "bun"],
      ["bun.lockb", "bun"],
    ];
    for (const [file, manager] of cases) {
      expect(await detectPackageManager({}, has(file))).toEqual({
        manager,
        source: "lockfile",
        hasLockfile: true,
      });
    }
  });

  it("ignores an unknown packageManager value", async () => {
    expect(
      await detectPackageManager(
        { packageManager: "cargo@1" },
        has("yarn.lock"),
      ),
    ).toMatchObject({ manager: "yarn", source: "lockfile" });
  });

  it("defaults to npm without a lockfile", async () => {
    expect(await detectPackageManager({}, has())).toEqual({
      manager: "npm",
      source: "default",
      hasLockfile: false,
    });
  });
});

describe("installPlan", () => {
  it("uses frozen installs with a lockfile and a lenient fallback", () => {
    expect(installPlan("npm", true)).toEqual({
      frozen: "npm ci",
      fallback: "npm install",
    });
    expect(installPlan("pnpm", true)).toEqual({
      frozen: "pnpm install --frozen-lockfile",
      fallback: "pnpm install",
    });
    expect(installPlan("yarn", true)).toEqual({
      frozen: "yarn install --frozen-lockfile",
      fallback: "yarn install",
    });
  });

  it("uses a plain install without a lockfile", () => {
    expect(installPlan("npm", false)).toEqual({
      frozen: "npm install",
      fallback: null,
    });
    expect(installPlan("pnpm", false)).toEqual({
      frozen: "pnpm install",
      fallback: null,
    });
  });

  it("can't install with bun yet", () => {
    expect(installPlan("bun", true)).toBeNull();
  });
});
