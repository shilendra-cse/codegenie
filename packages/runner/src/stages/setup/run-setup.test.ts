import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { JobEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { runSetup } from "./run-setup.js";

const nodeRepo = {
  "package.json": JSON.stringify({
    scripts: { test: "vitest run", lint: "eslint ." },
  }),
  "package-lock.json": "{}",
};

function setup(files: Record<string, string>, installOk = true) {
  const sandbox = new FakeSandbox(files);
  sandbox.execHandler = () => ({
    exitCode: installOk ? 0 : 1,
    stdout: "npm ERR! boom",
  });
  const events: JobEvent[] = [];
  return { sandbox, events, emit: (e: JobEvent) => events.push(e) };
}

describe("runSetup", () => {
  it("detects, installs and returns the checks, emitting start and finish events", async () => {
    const { sandbox, events, emit } = setup(nodeRepo);
    const result = await runSetup(sandbox, { runId: "run-1", emit });

    expect(result).toMatchObject({
      ecosystem: "node",
      packageManager: "npm",
      install: { command: "npm ci", status: "ok" },
      checks: [
        { name: "lint", command: "npm run lint", cwd: "." },
        { name: "test", command: "npm run test", cwd: "." },
      ],
      notes: [],
    });
    expect(events.map((e) => e.type)).toEqual([
      "setup_started",
      "setup_completed",
    ]);
    expect(events[1]).toMatchObject({
      jobId: "run-1",
      success: true,
      commands: {
        install: "npm ci",
        lint: "npm run lint",
        test: "npm run test",
      },
    });
  });

  it("reports a failed install in notes without throwing", async () => {
    const { sandbox, events, emit } = setup(nodeRepo, false);
    const result = await runSetup(sandbox, { runId: "run-1", emit });
    expect(result.install).toMatchObject({
      status: "failed",
      command: "npm install",
    });
    expect(result.notes).toEqual([
      expect.stringMatching(/^Installing dependencies failed \(npm install\)/),
    ]);
    expect(events[1]).toMatchObject({ success: false });
  });

  it("explains when no supported project type is found", async () => {
    const { sandbox, emit } = setup({ "main.go": "" });
    const result = await runSetup(sandbox, { runId: "run-1", emit });
    expect(result).toMatchObject({
      ecosystem: null,
      packageManager: null,
      install: { status: "skipped" },
      checks: [],
    });
    expect(result.notes[0]).toMatch(/No supported project type was detected/);
    expect(sandbox.execCalls).toHaveLength(0);
  });

  it("applies overrides for install and checks", async () => {
    const { sandbox } = setup(nodeRepo);
    const result = await runSetup(sandbox, {
      runId: "run-1",
      overrides: {
        install: "npm install --legacy-peer-deps",
        checks: [
          { name: "test", command: "npm run test:unit", cwd: "." },
          { name: "build", command: "npm run build", cwd: "." },
        ],
      },
    });
    expect(result.install.command).toBe("npm install --legacy-peer-deps");
    expect(result.checks).toEqual([
      { name: "lint", command: "npm run lint", cwd: "." },
      { name: "test", command: "npm run test:unit", cwd: "." },
      { name: "build", command: "npm run build", cwd: "." },
    ]);
  });

  it("can skip installing", async () => {
    const { sandbox } = setup(nodeRepo);
    const result = await runSetup(sandbox, {
      runId: "run-1",
      overrides: { install: false },
    });
    expect(result.install.status).toBe("skipped");
    expect(sandbox.execCalls).toHaveLength(0);
  });
});
