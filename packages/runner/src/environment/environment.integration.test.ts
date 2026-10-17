// Real Docker sandbox with network access: runs actual npm and pnpm installs.
import { DockerSandbox } from "@codegenie/sandbox";
import { dockerSandboxOrSkip } from "@codegenie/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { applySteps } from "./apply.js";
import { runChecks } from "./checks.js";
import { draftEnvironment } from "./draft/draft.js";

const probe = await dockerSandboxOrSkip("environment");
const sandboxes: DockerSandbox[] = [];

async function sandboxWith(files: Record<string, string>) {
  const sandbox =
    sandboxes.length === 0 && probe ? probe : await DockerSandbox.create();
  sandboxes.push(sandbox);
  for (const [path, content] of Object.entries(files)) {
    await sandbox.writeFile(path, content);
  }
  return sandbox;
}

describe.skipIf(!probe)("environment against DockerSandbox", () => {
  afterAll(async () => {
    await Promise.all(sandboxes.map((s) => s.destroy()));
  });

  it("drafts and applies an npm project, and its test check passes", async () => {
    const sandbox = await sandboxWith({
      "package.json": JSON.stringify({
        name: "npm-app",
        type: "module",
        dependencies: { "is-number": "7.0.0" },
        scripts: { test: "node --test" },
      }),
      "test/basic.test.js":
        'import { test } from "node:test";\nimport isNumber from "is-number";\ntest("works", () => { if (!isNumber(5)) throw new Error("no"); });\n',
    });

    const draft = await draftEnvironment(sandbox);
    const steps = await applySteps(sandbox, draft.steps);
    expect(steps).toMatchObject([{ command: "npm install", status: "ok" }]);
    const checks = await runChecks(sandbox, draft.checks, "baseline");
    expect(checks).toMatchObject([{ name: "test", status: "passing" }]);
  });

  it("installs a pnpm project via corepack without prompting", async () => {
    const sandbox = await sandboxWith({
      "package.json": JSON.stringify({
        name: "pnpm-app",
        packageManager: "pnpm@10.18.1",
        dependencies: { "is-number": "7.0.0" },
        scripts: { test: "node -e \"require('is-number')\"" },
      }),
    });

    const draft = await draftEnvironment(sandbox);
    expect(await applySteps(sandbox, draft.steps)).toMatchObject([
      { command: "pnpm install", status: "ok" },
    ]);
    expect(await runChecks(sandbox, draft.checks, "baseline")).toMatchObject([
      { status: "passing" },
    ]);
  });

  it("classifies a missing script as broken", async () => {
    const sandbox = await sandboxWith({
      "package.json": JSON.stringify({ name: "x", scripts: {} }),
    });
    const [result] = await runChecks(
      sandbox,
      [{ name: "lint", cwd: ".", command: "npm run lint" }],
      "baseline",
    );
    expect(result!.status).toBe("broken");
  });

  it("runs commands with CI=true so test runners don't start in watch mode", async () => {
    const sandbox = await sandboxWith({});
    expect((await sandbox.exec('printf "%s" "$CI"')).stdout).toBe("true");
  });
});
