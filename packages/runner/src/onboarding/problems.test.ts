import type { TryResult } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { findProblems } from "./problems.js";

const step = (status: "ok" | "failed") => ({
  name: "install",
  cwd: "api",
  command: "npm ci",
  status,
  durationMs: 1,
  logPath: "/l",
});
const check = (
  name: "lint" | "test",
  status: TryResult["checks"][number]["status"],
) => ({
  name,
  cwd: ".",
  command: `npm run ${name}`,
  status,
  durationMs: 1,
  logPath: "/l",
});

describe("findProblems", () => {
  it("has nothing to report when everything works", () => {
    expect(
      findProblems({ steps: [step("ok")], checks: [check("lint", "passing")] }),
    ).toEqual([]);
  });

  it("reports failed steps and every check that isn't passing", () => {
    expect(
      findProblems({
        steps: [step("failed")],
        checks: [check("lint", "broken"), check("test", "failing")],
      }),
    ).toEqual([
      'Setup step "install" (api) failed.',
      'Check "lint" could not run.',
      'Check "test" is failing.',
    ]);
  });

  it("reports a setup without checks, or without anything", () => {
    expect(findProblems({ steps: [step("ok")], checks: [] })).toEqual([
      "No checks were found.",
    ]);
    expect(findProblems({ steps: [], checks: [] })).toEqual([
      "Nothing to install or check was detected.",
    ]);
  });
});
