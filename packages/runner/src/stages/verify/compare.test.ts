import type { CheckResult } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { compareCheck, compareChecks } from "./compare.js";

describe("compareCheck", () => {
  it.each([
    ["passing", "passing", "passing"],
    ["failing", "passing", "fixed"],
    ["broken", "passing", "fixed"],
    ["passing", "failing", "regressed"],
    ["failing", "failing", "still-failing"],
    [undefined, "passing", "passing"],
    [undefined, "failing", "failing"],
  ] as const)("%s → %s = %s", (before, after, expected) => {
    expect(compareCheck(before, after)).toBe(expected);
  });
});

describe("compareChecks", () => {
  const result = (
    name: "lint" | "test",
    cwd: string,
    status: CheckResult["status"],
  ): CheckResult => ({
    name,
    cwd,
    command: `npm run ${name}`,
    status,
    durationMs: 1,
    logPath: "/l",
  });

  it("matches checks by name and folder", () => {
    const compared = compareChecks(
      [result("test", "api", "passing"), result("test", "web", "failing")],
      [result("test", "web", "passing"), result("test", "api", "failing")],
    );
    expect(compared.map((c) => [c.cwd, c.comparison])).toEqual([
      ["web", "fixed"],
      ["api", "regressed"],
    ]);
  });

  it("works without a baseline", () => {
    expect(
      compareChecks(null, [result("lint", ".", "failing")])[0]!.comparison,
    ).toBe("failing");
  });
});
