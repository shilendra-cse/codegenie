import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { classify, runChecks } from "./checks.js";

const run = (exitCode: number, output = "", timedOut = false) => ({
  ok: exitCode === 0 && !timedOut,
  exitCode,
  timedOut,
  output,
});

describe("classify", () => {
  it.each([
    [run(0), "passing"],
    [run(1, "2 tests failed"), "failing"],
    [run(124, "", true), "timed-out"],
    [run(127, "bash: vitest: command not found"), "broken"],
    [run(126), "broken"],
    [run(1, 'npm error Missing script: "lint"'), "broken"],
    [run(1, "ERR_PNPM_NO_SCRIPT  Missing script: test"), "broken"],
    [run(1, 'error Command "lint" not found.'), "broken"],
  ] as const)("%j → %s", (input, expected) => {
    expect(classify(input)).toBe(expected);
  });
});

describe("runChecks", () => {
  it("runs each check in its folder and keeps output only when not passing", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) =>
      command.includes("npm run test")
        ? { exitCode: 1, stdout: "1 failing" }
        : {};
    const results = await runChecks(
      sandbox,
      [
        { name: "lint", command: "npm run lint", cwd: "." },
        { name: "test", command: "npm run test", cwd: "api" },
      ],
      "baseline",
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: "lint",
        status: "passing",
        logPath: "/tmp/codegenie/logs/baseline-1-lint.log",
      }),
      expect.objectContaining({
        name: "test",
        cwd: "api",
        status: "failing",
        outputTail: "1 failing",
      }),
    ]);
    expect(results[0]).not.toHaveProperty("outputTail");
    expect(sandbox.execCalls.map((c) => c.options.cwd)).toEqual([".", "api"]);
  });
});
