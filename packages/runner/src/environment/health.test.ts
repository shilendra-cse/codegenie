import { FakeSandbox } from "@hobai/sandbox/testing";
import type { EnvironmentConfig } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { uncoveredProjects } from "./health.js";

const config = (cwds: string[]): EnvironmentConfig => ({
  version: 1,
  steps: cwds.map((cwd) => ({ name: "install", cwd, command: "npm ci" })),
  checks: [],
  meta: { source: "detected", createdAt: "", decisions: [] },
});

describe("uncoveredProjects", () => {
  it("finds a sub-project added after the environment was made", async () => {
    const sandbox = new FakeSandbox({
      "package.json": JSON.stringify({
        devDependencies: { concurrently: "^9" },
      }),
      "backend/package.json": "{}",
      "client/package.json": "{}",
      "admin/package.json": "{}",
    });
    expect(
      await uncoveredProjects(sandbox, config(["backend", "./client/"])),
    ).toEqual(["admin"]);
  });

  it("counts a folder covered by a check alone, and ignores workspace packages", async () => {
    const workspace = new FakeSandbox({
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
      "packages/ui/package.json": "{}",
    });
    expect(await uncoveredProjects(workspace, config(["."]))).toEqual([]);

    const checked = new FakeSandbox({
      "web/package.json": "{}",
      "api/package.json": "{}",
    });
    const onlyChecks: EnvironmentConfig = {
      ...config(["api"]),
      checks: [{ name: "lint", cwd: "web", command: "npm run lint" }],
    };
    expect(await uncoveredProjects(checked, onlyChecks)).toEqual([]);
  });

  it("reports a root project the environment doesn't cover", async () => {
    const sandbox = new FakeSandbox({
      "package.json": JSON.stringify({ name: "app" }),
    });
    expect(await uncoveredProjects(sandbox, config([]))).toEqual(["."]);
  });
});
