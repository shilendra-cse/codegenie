import type { RunResult } from "@hobai/runner";
import type { Sandbox } from "@hobai/sandbox";
import type { EvalTask } from "../suite/tasks.js";
import { checks } from "./checks.js";
import { hiddenTests } from "./hidden-tests.js";

export type Grade = {
  /** null when a person has to judge the result. */
  passed: boolean | null;
  detail: string;
};

/** Judges the agent's work in the sandbox it was done in. */
export async function grade(
  task: EvalTask,
  sandbox: Sandbox,
  run: RunResult,
): Promise<Grade> {
  if (!run.agent) {
    return {
      passed: false,
      detail: `The run failed at ${run.failedStage ?? "an early stage"}: ${run.error ?? run.status}`,
    };
  }
  switch (task.grader.type) {
    case "hidden-tests":
      return hiddenTests(task, task.grader, sandbox);
    case "checks":
      return checks(task.grader.passing, run);
    case "manual":
      return { passed: null, detail: "Needs a manual review of the diff." };
  }
}
