import { scriptedModel } from "@codegenie/agent/testing";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { JobEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { runJob, type RunJobOptions } from "./run-job.js";

const repo = {
  "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
  "package-lock.json": "{}",
  "src/app.js": "export const a = 1;\n",
};

function fakeSandbox(failOn?: string) {
  const sandbox = new FakeSandbox(repo);
  let destroyed = 0;
  sandbox.destroy = async () => {
    destroyed += 1;
  };
  sandbox.execHandler = (command) => {
    if (failOn && command.includes(failOn))
      return { exitCode: 1, stderr: "boom" };
    if (command.includes("git rev-parse HEAD")) return { stdout: "base123\n" };
    if (command.includes("--numstat")) return { stdout: "1\t1\tsrc/app.js\n" };
    if (command.includes("--no-color"))
      return { stdout: "diff --git a/src/app.js\n" };
    return {};
  };
  return { sandbox, destroyed: () => destroyed };
}

function options(
  sandbox: FakeSandbox,
  overrides: Partial<RunJobOptions> = {},
): RunJobOptions {
  const { resolved } = scriptedModel([
    { toolCalls: [{ toolName: "read_file", input: { path: "src/app.js" } }] },
    {
      toolCalls: [
        {
          toolName: "edit_file",
          input: { path: "src/app.js", oldString: "a = 1", newString: "a = 2" },
        },
      ],
    },
    {
      toolCalls: [
        { toolName: "finish_task", input: { summary: "Set a to 2." } },
      ],
    },
  ]);
  return {
    runId: "job-1",
    task: "Set a to 2",
    source: { type: "git", url: "https://github.com/acme/app.git" },
    model: resolved,
    createSandbox: async () => sandbox,
    ...overrides,
  };
}

describe("runJob", () => {
  it("runs every stage in order and returns the full result", async () => {
    const { sandbox, destroyed } = fakeSandbox();
    const events: JobEvent[] = [];
    const result = await runJob(
      options(sandbox, { emit: (event) => events.push(event) }),
    );

    expect(result).toMatchObject({
      status: "succeeded",
      sandboxId: "fake-sandbox",
      checkout: { description: "https://github.com/acme/app.git" },
      setup: { packageManager: "npm", install: { status: "ok" } },
      agent: { status: "succeeded", summary: "Set a to 2." },
      verify: [{ name: "test", passed: true }],
      checksPassed: true,
      diff: { files: [{ path: "src/app.js", added: 1, removed: 1 }] },
    });
    expect(sandbox.files.get("/workspace/src/app.js")).toBe(
      "export const a = 2;\n",
    );
    expect(
      events
        .filter((e) => e.type === "stage_changed")
        .map((e) => (e as { stage: string }).stage),
    ).toEqual(["prepare", "checkout", "setup", "agent", "verify"]);
    expect(events.map((e) => e.type)).toContain("sandbox_created");
    expect(destroyed()).toBe(1);
  });

  it("reports a failed checkout and still destroys the sandbox", async () => {
    const { sandbox, destroyed } = fakeSandbox("git clone");
    const result = await runJob(options(sandbox));
    expect(result).toMatchObject({
      status: "failed",
      failedStage: "checkout",
      error: "git clone failed: boom",
    });
    expect(result.agent).toBeUndefined();
    expect(destroyed()).toBe(1);
  });

  it("reports when the sandbox can't be created", async () => {
    const result = await runJob(
      options(new FakeSandbox(), {
        createSandbox: async () => {
          throw new Error("Docker is not running");
        },
      }),
    );
    expect(result).toMatchObject({
      status: "failed",
      failedStage: "sandbox",
      error: "Docker is not running",
    });
  });

  it("stops before any work when already cancelled, and keeps the sandbox on request", async () => {
    const { sandbox, destroyed } = fakeSandbox();
    const controller = new AbortController();
    controller.abort();
    const result = await runJob(
      options(sandbox, { signal: controller.signal, keepSandbox: true }),
    );
    expect(result.status).toBe("cancelled");
    expect(sandbox.execCalls).toHaveLength(0);
    expect(destroyed()).toBe(0);
  });

  it("reports failing checks without changing the agent's status", async () => {
    const { sandbox } = fakeSandbox("npm run test");
    const result = await runJob(options(sandbox));
    expect(result).toMatchObject({ status: "succeeded", checksPassed: false });
  });
});
