import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { RepoReader } from "../../core/repo-reader.js";
import { nodeDetector } from "./node-detector.js";

const detect = (files: Record<string, string>) =>
  nodeDetector.detect(new RepoReader(new FakeSandbox(files)));

describe("nodeDetector", () => {
  it("does not match repositories without package.json", async () => {
    expect(await detect({ "main.go": "package main" })).toBeNull();
  });

  it("detects package manager, install and checks", async () => {
    expect(
      await detect({
        "package.json": JSON.stringify({
          scripts: { test: "vitest run", lint: "eslint ." },
          devDependencies: { typescript: "^5" },
        }),
        "pnpm-lock.yaml": "lockfileVersion: 9",
        "tsconfig.json": "{}",
      }),
    ).toEqual({
      ecosystem: "node",
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
      notes: [],
    });
  });

  it("reports an invalid package.json instead of failing", async () => {
    const detection = await detect({ "package.json": "{ broken" });
    expect(detection).toMatchObject({
      ecosystem: "node",
      install: null,
      checks: [],
    });
    expect(detection!.notes[0]).toMatch(/package\.json is not valid JSON/);
  });

  it("notes bun repositories and repositories without scripts", async () => {
    const detection = await detect({ "package.json": "{}", "bun.lockb": "" });
    expect(detection).toMatchObject({
      packageManager: "bun",
      install: null,
      checks: [],
    });
    expect(detection!.notes).toEqual([
      expect.stringMatching(/uses bun, which is not available/),
      expect.stringMatching(/No lint, typecheck, test or build scripts/),
    ]);
  });
});
