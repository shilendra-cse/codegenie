import { FakeSandbox } from "@hobai/sandbox/testing";
import { describe, expect, it } from "vitest";
import { RepoReader } from "../repo-reader.js";
import { nodeDetector } from "./node-detector.js";

const detect = (files: Record<string, string>) =>
  nodeDetector.detect(new RepoReader(new FakeSandbox(files)));

const pkg = (value: object) => JSON.stringify(value);
const npmCi = { frozen: "npm ci", fallback: "npm install" };

describe("nodeDetector", () => {
  it("does not match repositories without package.json", async () => {
    expect(await detect({ "main.go": "package main" })).toBeNull();
  });

  it("detects package manager, install and checks", async () => {
    expect(
      await detect({
        "package.json": pkg({
          scripts: { test: "vitest run", lint: "eslint ." },
          devDependencies: { typescript: "^5" },
        }),
        "pnpm-lock.yaml": "lockfileVersion: 9",
        "tsconfig.json": "{}",
      }),
    ).toEqual({
      ecosystem: "node",
      projects: [
        {
          cwd: ".",
          packageManager: "pnpm",
          install: {
            frozen: "pnpm install --frozen-lockfile",
            fallback: "pnpm install",
          },
          checks: [
            { name: "lint", command: "pnpm run lint", cwd: "." },
            { name: "typecheck", command: "pnpm exec tsc --noEmit", cwd: "." },
            { name: "test", command: "pnpm run test", cwd: "." },
          ],
        },
      ],
      notes: [],
    });
  });

  it("reports an invalid package.json instead of failing", async () => {
    const detection = await detect({ "package.json": "{ broken" });
    expect(detection).toMatchObject({ ecosystem: "node", projects: [] });
    expect(detection!.notes[0]).toMatch(/package\.json is not valid JSON/);
  });

  it("notes bun repositories and repositories without scripts", async () => {
    const detection = await detect({ "package.json": "{}", "bun.lockb": "" });
    expect(detection!.projects).toEqual([
      { cwd: ".", packageManager: "bun", install: null, checks: [] },
    ]);
    expect(detection!.notes).toEqual([
      expect.stringMatching(/This repository uses bun, which is not available/),
      expect.stringMatching(/No lint, typecheck, test or build scripts/),
    ]);
  });

  it("sets up each sub-project when the root only runs tools (DoDesk)", async () => {
    const detection = await detect({
      "package.json": pkg({
        scripts: { lint: "npm run lint --prefix backend" },
        devDependencies: { concurrently: "^9" },
      }),
      "package-lock.json": "{}",
      "backend/package.json": pkg({
        scripts: { lint: "eslint .", test: "vitest run", build: "tsc" },
      }),
      "backend/package-lock.json": "{}",
      "client/package.json": pkg({ scripts: { lint: "next lint" } }),
      "client/package-lock.json": "{}",
      "docs/readme.md": "",
    });
    expect(detection!.projects).toEqual([
      {
        cwd: "backend",
        packageManager: "npm",
        install: npmCi,
        checks: [
          { name: "lint", command: "npm run lint", cwd: "backend" },
          { name: "test", command: "npm run test", cwd: "backend" },
          { name: "build", command: "npm run build", cwd: "backend" },
        ],
      },
      {
        cwd: "client",
        packageManager: "npm",
        install: npmCi,
        checks: [{ name: "lint", command: "npm run lint", cwd: "client" }],
      },
    ]);
    expect(detection!.notes[0]).toMatch(/root package\.json only runs/);
  });

  it("sets up each folder when there is no root package.json (BuyerBook)", async () => {
    const detection = await detect({
      "server/package.json": pkg({
        scripts: { "type-check": "tsc --noEmit", build: "tsc" },
      }),
      "server/package-lock.json": "{}",
      "frontend/package.json": pkg({
        scripts: { lint: "eslint" },
        devDependencies: { typescript: "^5" },
      }),
      "frontend/tsconfig.json": "{}",
      ".vscode/settings.json": "{}",
    });
    expect(detection!.projects).toEqual([
      {
        cwd: "frontend",
        packageManager: "npm",
        install: { frozen: "npm install", fallback: null },
        checks: [
          { name: "lint", command: "npm run lint", cwd: "frontend" },
          {
            name: "typecheck",
            command: "npx --no-install tsc --noEmit",
            cwd: "frontend",
          },
        ],
      },
      {
        cwd: "server",
        packageManager: "npm",
        install: npmCi,
        checks: [
          { name: "typecheck", command: "npm run type-check", cwd: "server" },
          { name: "build", command: "npm run build", cwd: "server" },
        ],
      },
    ]);
    expect(detection!.notes).toEqual([]);
  });

  it("keeps a real root next to its sub-projects", async () => {
    const detection = await detect({
      "package.json": pkg({
        dependencies: { express: "^5" },
        scripts: { test: "node --test" },
      }),
      "admin/package.json": pkg({ scripts: { build: "vite build" } }),
    });
    expect(detection!.projects.map((p) => [p.cwd, p.checks.length])).toEqual([
      [".", 1],
      ["admin", 1],
    ]);
  });

  it("installs a workspace once and uses root scripts when it has them", async () => {
    const detection = await detect({
      "package.json": pkg({
        packageManager: "pnpm@10.18.1",
        scripts: { test: "pnpm -r test" },
      }),
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "pnpm-lock.yaml": "",
      "packages/ui/package.json": pkg({ scripts: { test: "vitest run" } }),
    });
    expect(detection!.projects).toEqual([
      {
        cwd: ".",
        packageManager: "pnpm",
        install: {
          frozen: "pnpm install --frozen-lockfile",
          fallback: "pnpm install",
        },
        checks: [{ name: "test", command: "pnpm run test", cwd: "." }],
      },
    ]);
    expect(detection!.notes).toEqual([
      "Workspace with 1 package: packages/ui.",
    ]);
  });

  it("checks each workspace package when the root has no check scripts", async () => {
    const detection = await detect({
      "package.json": pkg({ workspaces: ["apps/*", "lib", "**/odd"] }),
      "package-lock.json": "{}",
      "apps/web/package.json": pkg({ scripts: { lint: "eslint ." } }),
      "apps/api/package.json": pkg({ scripts: { test: "node --test" } }),
      "lib/package.json": pkg({ scripts: { build: "tsc" } }),
    });
    expect(detection!.projects).toHaveLength(1);
    expect(detection!.projects[0]!.checks).toEqual([
      { name: "test", command: "npm run test", cwd: "apps/api" },
      { name: "lint", command: "npm run lint", cwd: "apps/web" },
      { name: "build", command: "npm run build", cwd: "lib" },
    ]);
    expect(detection!.notes).toEqual([
      'Workspace pattern "**/odd" is not supported; its packages were not checked.',
      "Workspace with 3 packages: apps/api, apps/web, lib.",
    ]);
  });

  it("uses the root packageManager field for sub-projects without a lockfile", async () => {
    const detection = await detect({
      "package.json": pkg({ packageManager: "pnpm@10.18.1" }),
      "web/package.json": pkg({}),
    });
    expect(detection!.projects[0]).toMatchObject({
      cwd: "web",
      packageManager: "pnpm",
    });
  });

  it("sets up at most 8 projects and says which", async () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 9; i++) files[`p${i}/package.json`] = "{}";
    const detection = await detect(files);
    expect(detection!.projects).toHaveLength(8);
    expect(detection!.notes[0]).toMatch(
      /^Found 9 projects; only the first 8 are set up: p1, .*p8\.$/,
    );
  });
});
