import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { CheckResult } from "@codegenie/shared";
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
      logPath: "/tmp/codegenie/logs/verify-1-lint.log",
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
