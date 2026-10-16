import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scriptedModel } from "@codegenie/agent/testing";
import { dockerSandboxOrSkip } from "@codegenie/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { runJob } from "./run-job.js";

const probe = await dockerSandboxOrSkip("runJob");
await probe?.destroy();
const notReady = !probe;
const dirs: string[] = [];

function localRepo(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "cg-job-"));
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

describe.skipIf(notReady)("runJob against DockerSandbox", () => {
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("copies a local repo, lets the agent change it, verifies and diffs", async () => {
    const dir = localRepo({
      ".gitignore": ".env\n",
      "package.json": JSON.stringify({
        name: "calc",
        type: "module",
        scripts: { test: "node --test" },
      }),
      "src/math.js": "export const add = (a, b) => a - b;\n",
      "test/math.test.js":
        'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "../src/math.js";\ntest("add", () => assert.equal(add(2, 3), 5));\n',
    });
    writeFileSync(path.join(dir, ".env"), "SECRET=do-not-copy\n");
    writeFileSync(path.join(dir, "NOTES.md"), "uncommitted\n");

    const { resolved } = scriptedModel([
      {
        toolCalls: [{ toolName: "read_file", input: { path: "src/math.js" } }],
      },
      {
        toolCalls: [
          {
            toolName: "edit_file",
            input: {
              path: "src/math.js",
              oldString: "a - b",
              newString: "a + b",
            },
          },
          {
            toolName: "write_file",
            input: { path: "CHANGELOG.md", content: "- fix add\n" },
          },
        ],
      },
      {
        toolCalls: [
          { toolName: "finish_task", input: { summary: "Fixed add." } },
        ],
      },
    ]);

    const result = await runJob({
      runId: "it-job",
      task: "Fix add",
      source: { type: "local", path: dir },
      model: resolved,
      keepSandbox: true,
    });

    expect({ failedStage: result.failedStage, error: result.error }).toEqual(
      {},
    );
    expect(
      result.verify?.filter((c) => !c.passed).map((c) => c.outputTail),
    ).toEqual([]);
    expect(result).toMatchObject({
      status: "succeeded",
      checkout: { files: 5 },
      setup: { packageManager: "npm" },
      verify: [{ name: "test", passed: true }],
      checksPassed: true,
    });
    expect(result.diff!.files.map((f) => f.path).sort()).toEqual([
      "CHANGELOG.md",
      "src/math.js",
    ]);
    expect(result.diff!.patch).toContain(
      "+export const add = (a, b) => a + b;",
    );

    const kept = result.sandboxId!;
    const ls = execFileSync("docker", [
      "exec",
      kept,
      "ls",
      "-a",
      "/workspace",
    ]).toString();
    execFileSync("docker", ["rm", "-f", kept], { stdio: "ignore" });
    expect(ls).toContain("NOTES.md");
    expect(ls).not.toContain(".env");
  });

  it("clones a public git repository", async () => {
    const { resolved } = scriptedModel([
      {
        toolCalls: [
          { toolName: "finish_task", input: { summary: "Nothing to do." } },
        ],
      },
    ]);
    const result = await runJob({
      runId: "it-clone",
      task: "Look around",
      source: {
        type: "git",
        url: "https://github.com/octocat/Hello-World.git",
      },
      model: resolved,
    });
    expect({ failedStage: result.failedStage, error: result.error }).toEqual(
      {},
    );
    expect(result).toMatchObject({
      status: "succeeded",
      setup: { ecosystem: null },
      checksPassed: null,
      diff: { files: [] },
    });
  });
});
