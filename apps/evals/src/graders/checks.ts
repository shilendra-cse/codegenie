import type { JobResult } from "@codegenie/runner";
import { checkKey } from "@codegenie/shared";
import type { Grade } from "./grade.js";

/** Passes when every listed check (name@cwd) passes after the agent's changes. */
export function checks(passing: string[], job: JobResult): Grade {
  const results = new Map(
    (job.verify?.checks ?? []).map((c) => [checkKey(c), c.status]),
  );
  return {
    passed: passing.every((key) => results.get(key) === "passing"),
    detail: passing
      .map((key) => `${key}: ${results.get(key) ?? "not run"}`)
      .join("\n"),
  };
}
