import type { RunResult } from "@hobai/runner";
import { checkKey } from "@hobai/shared";
import type { Grade } from "./grade.js";

/** Passes when every listed check (name@cwd) passes after the agent's changes. */
export function checks(passing: string[], run: RunResult): Grade {
  const results = new Map(
    (run.verify?.checks ?? []).map((c) => [checkKey(c), c.status]),
  );
  return {
    passed: passing.every((key) => results.get(key) === "passing"),
    detail: passing
      .map((key) => `${key}: ${results.get(key) ?? "not run"}`)
      .join("\n"),
  };
}
