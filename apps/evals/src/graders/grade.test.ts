import type { RunResult } from "@codegenie/runner";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { loadTasks } from "../suite/tasks.js";
import { grade } from "./grade.js";

const run = (overrides: Partial<RunResult> = {}): RunResult =>
  ({
    status: "succeeded",
    durationMs: 1,
    agent: { status: "succeeded" },
    ...overrides,
  }) as RunResult;

describe("grade", () => {
  it("copies the hidden tests in and passes when they pass", async () => {
    const [task] = await loadTasks({ tasks: ["http-api/health"] });
    const sandbox = new FakeSandbox();
    expect(await grade(task!, sandbox, run())).toEqual({
      passed: true,
      detail: "Hidden tests passed.",
    });
    expect(
      sandbox.files.has("/workspace/codegenie-hidden/health.test.js"),
    ).toBe(true);
    expect(sandbox.execCalls[0]).toMatchObject({
      command: "node --test 'codegenie-hidden/*.test.*' 2>&1",
      options: { cwd: "." },
    });
  });

  it("fails with the end of the test output", async () => {
    const [task] = await loadTasks({ tasks: ["http-api/health"] });
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({
      exitCode: 1,
      stdout: "✖ GET /health returns ok",
    });
    expect(await grade(task!, sandbox, run())).toEqual({
      passed: false,
      detail: "Hidden tests failed:\n✖ GET /health returns ok",
    });
  });

  it("doesn't grade a run that failed before the agent ran", async () => {
    const [task] = await loadTasks({ tasks: ["http-api/health"] });
    const sandbox = new FakeSandbox();
    const result = await grade(
      task!,
      sandbox,
      run({
        status: "failed",
        failedStage: "checkout",
        error: "clone failed",
        agent: undefined,
      }),
    );
    expect(result).toEqual({
      passed: false,
      detail: "The run failed at checkout: clone failed",
    });
    expect(sandbox.execCalls).toEqual([]);
  });

  it("grades by checks, and leaves manual tasks to a person", async () => {
    const [task] = await loadTasks({ tasks: ["http-api/health"] });
    const checksTask = {
      ...task!,
      grader: {
        type: "checks" as const,
        passing: ["typecheck@server", "test@server"],
      },
    };
    const verify = {
      checks: [
        {
          name: "typecheck",
          cwd: "server",
          command: "",
          status: "passing",
          comparison: "fixed",
        },
        {
          name: "test",
          cwd: "server",
          command: "",
          status: "failing",
          comparison: "still-failing",
        },
      ],
    } as unknown as RunResult["verify"];
    expect(await grade(checksTask, new FakeSandbox(), run({ verify }))).toEqual(
      {
        passed: false,
        detail: "typecheck@server: passing\ntest@server: failing",
      },
    );
    expect(
      await grade(
        { ...task!, grader: { type: "manual" } },
        new FakeSandbox(),
        run(),
      ),
    ).toEqual({ passed: null, detail: "Needs a manual review of the diff." });
  });
});
