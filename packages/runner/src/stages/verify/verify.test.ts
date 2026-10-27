import { SANDBOX_LOG_DIR } from "@hobai/sandbox";
import { FakeSandbox } from "@hobai/sandbox/testing";
import type { CheckResult } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { runVerify } from "./verify.js";

const checks = [
  { name: "lint" as const, command: "npm run lint", cwd: "." },
  { name: "test" as const, command: "npm run test", cwd: "." },
];

const baseline = (
  lint: CheckResult["status"],
  test: CheckResult["status"],
): CheckResult[] => [
  { ...checks[0]!, status: lint, durationMs: 1, logPath: "/b1" },
  { ...checks[1]!, status: test, durationMs: 1, logPath: "/b2" },
];

describe("runVerify", () => {
  it("compares every check with its baseline", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) =>
      command.includes("npm run lint")
        ? { exitCode: 1, stdout: "lint error" }
        : {};

    const result = await runVerify(
      sandbox,
      checks,
      baseline("passing", "failing"),
    );
    expect(result).toMatchObject({ passed: false, fixed: 1, regressions: 1 });
    expect(result.checks.map((c) => [c.name, c.comparison])).toEqual([
      ["lint", "regressed"],
      ["test", "fixed"],
    ]);
    expect(result.checks[0]).toMatchObject({
      outputTail: "lint error",
      logPath: `${SANDBOX_LOG_DIR}/verify-1-lint.log`,
    });
  });

  it("reports null when there are no checks", async () => {
    expect(await runVerify(new FakeSandbox(), [], null)).toEqual({
      checks: [],
      passed: null,
      fixed: 0,
      regressions: 0,
    });
  });
});

describe("runVerify at the time limit", () => {
  it("starts no check once the signal is aborted, and leaves the result unknown", async () => {
    const sandbox = new FakeSandbox();
    const stop = new AbortController();
    sandbox.execHandler = () => {
      stop.abort();
      return {};
    };

    const result = await runVerify(sandbox, checks, null, stop.signal);

    expect(result.checks.map((c) => c.name)).toEqual(["lint"]);
    expect(result.notRun?.map((c) => c.name)).toEqual(["test"]);
    expect(result.passed).toBeNull();
  });

  it("still fails when a check that ran failed", async () => {
    const sandbox = new FakeSandbox();
    const stop = new AbortController();
    sandbox.execHandler = () => {
      stop.abort();
      return { exitCode: 1, stdout: "lint error" };
    };

    const result = await runVerify(sandbox, checks, null, stop.signal);

    expect(result.passed).toBe(false);
  });
});
