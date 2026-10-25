import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scriptedModel } from "@hobai/agent/testing";
import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { autoChannel } from "./auto-channel.js";
import { runOnboarding } from "./run-onboarding.js";

const probe = await dockerSandboxOrSkip("runOnboarding");
await probe?.destroy();
const dirs: string[] = [];

function localRepo(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "cg-onboard-"));
  dirs.push(dir);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
  return dir;
}

describe.skipIf(!probe)("runOnboarding against DockerSandbox", () => {
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("drafts, lets the agent drop a check that can't run, and verifies in a fresh sandbox", async () => {
    const dir = localRepo({
      "package.json": JSON.stringify({
        name: "app",
        scripts: { lint: "eslint .", test: "node --test" },
      }),
      "test/ok.test.js":
        'const { test } = require("node:test");\ntest("ok", () => {});\n',
    });
    const { resolved, model } = scriptedModel([
      {
        toolCalls: [
          {
            toolName: "try_environment",
            input: {
              steps: [{ name: "install", cwd: ".", command: "npm install" }],
              checks: [{ name: "test", cwd: ".", command: "npm run test" }],
            },
          },
        ],
      },
      {
        toolCalls: [
          {
            toolName: "finish_setup",
            input: {
              steps: [{ name: "install", cwd: ".", command: "npm install" }],
              checks: [{ name: "test", cwd: ".", command: "npm run test" }],
              notes: ["Left out lint: eslint isn't installed."],
            },
          },
        ],
      },
    ]);
    const info: string[] = [];

    const result = await runOnboarding({
      runId: "it-onboard",
      source: { type: "local", path: dir },
      model: resolved,
      channel: autoChannel((m) => info.push(m)),
    });

    expect({ status: result.status, error: result.error }).toEqual({
      status: "approved",
      error: undefined,
    });
    expect(JSON.stringify(model.doStreamCalls[0]!.prompt)).toContain(
      "eslint: not found",
    );
    expect(result.config).toMatchObject({
      steps: [{ name: "install", cwd: ".", command: "npm install" }],
      checks: [{ name: "test", cwd: ".", command: "npm run test" }],
      meta: {
        source: "ai",
        validation: {
          steps: { "install@.": "ok" },
          checks: { "test@.": "passing" },
        },
      },
    });
    expect(result.final!.checks.map((c) => [c.name, c.status])).toEqual([
      ["test", "passing"],
    ]);
    expect(info.some((m) => m.includes('Check "lint" could not run.'))).toBe(
      true,
    );
  });
});
