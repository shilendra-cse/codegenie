import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { runVerify } from "./verify.js";

describe("runVerify", () => {
  it("runs every check in its folder and records the outcome", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) =>
      command.includes("npm run test")
        ? { exitCode: 1, stdout: "ok 1\nnot ok 2 - health" }
        : {};
    const outcomes = await runVerify(sandbox, [
      { name: "lint", command: "npm run lint", cwd: "." },
      { name: "test", command: "npm run test", cwd: "api" },
    ]);

    expect(outcomes).toEqual([
      expect.objectContaining({
        name: "lint",
        passed: true,
        logPath: "/tmp/codegenie/logs/verify-1-lint.log",
      }),
      expect.objectContaining({
        name: "test",
        cwd: "api",
        passed: false,
        exitCode: 1,
        outputTail: "ok 1\nnot ok 2 - health",
      }),
    ]);
    expect(outcomes[0]).not.toHaveProperty("outputTail");
    expect(sandbox.execCalls.map((c) => c.options.cwd)).toEqual([".", "api"]);
  });

  it("returns nothing when there are no checks", async () => {
    expect(await runVerify(new FakeSandbox(), [])).toEqual([]);
  });
});
