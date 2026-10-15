// Real Docker sandbox with network access: runs actual npm and pnpm installs.
import { DockerSandbox } from "@codegenie/sandbox";
import { afterAll, describe, expect, it } from "vitest";
import { runSetup } from "./run-setup.js";

async function dockerSandboxOrSkip(): Promise<DockerSandbox | null> {
  try {
    return await DockerSandbox.create();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.CI) {
      throw new Error(
        `setup integration tests require Docker in CI: ${reason}`,
        {
          cause: error,
        },
      );
    }
    console.warn(`Skipping setup integration tests: ${reason}`);
    return null;
  }
}

const sandboxes: DockerSandbox[] = [];
const first = await dockerSandboxOrSkip();

async function freshSandbox(files: Record<string, string>) {
  const sandbox =
    sandboxes.length === 0 ? first! : await DockerSandbox.create();
  sandboxes.push(sandbox);
  for (const [path, content] of Object.entries(files)) {
    await sandbox.writeFile(path, content);
  }
  return sandbox;
}

describe.skipIf(!first)("runSetup against DockerSandbox", () => {
  afterAll(async () => {
    await Promise.all(sandboxes.map((s) => s.destroy()));
    if (first && !sandboxes.includes(first)) await first.destroy();
  });

  it("sets up an npm project and its test check passes", async () => {
    const sandbox = await freshSandbox({
      "package.json": JSON.stringify({
        name: "npm-app",
        type: "module",
        dependencies: { "is-number": "7.0.0" },
        scripts: { test: "node --test" },
      }),
      "test/basic.test.js":
        'import { test } from "node:test";\nimport isNumber from "is-number";\ntest("works", () => { if (!isNumber(5)) throw new Error("no"); });\n',
    });

    const result = await runSetup(sandbox, { runId: "it-npm" });
    expect(result).toMatchObject({
      ecosystem: "node",
      packageManager: "npm",
      install: { command: "npm install", status: "ok" },
      checks: [{ name: "test", command: "npm run test", cwd: "." }],
    });
    expect((await sandbox.exec("npm run test")).exitCode).toBe(0);
  });

  it("sets up a pnpm project via corepack without prompting", async () => {
    const sandbox = await freshSandbox({
      "package.json": JSON.stringify({
        name: "pnpm-app",
        packageManager: "pnpm@10.18.1",
        dependencies: { "is-number": "7.0.0" },
        scripts: { test: "node -e \"require('is-number')\"" },
      }),
    });

    const result = await runSetup(sandbox, { runId: "it-pnpm" });
    expect(result).toMatchObject({
      packageManager: "pnpm",
      install: { command: "pnpm install", status: "ok" },
    });
    expect((await sandbox.exec("pnpm run test")).exitCode).toBe(0);
  });

  it("runs commands with CI=true so test runners don't start in watch mode", async () => {
    const sandbox = await freshSandbox({});
    expect((await sandbox.exec('printf "%s" "$CI"')).stdout).toBe("true");
  });
});
