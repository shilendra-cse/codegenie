import type { JobResult } from "@codegenie/runner";
import type { Sandbox } from "@codegenie/sandbox";
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
  job: JobResult,
): Promise<Grade> {
  if (!job.agent) {
    return {
      passed: false,
      detail: `The job failed at ${job.failedStage ?? "an early stage"}: ${job.error ?? job.status}`,
    };
  }
  switch (task.grader.type) {
    case "hidden-tests":
      return hiddenTests(task, task.grader, sandbox);
    case "checks":
      return checks(task.grader.passing, job);
    case "manual":
      return { passed: null, detail: "Needs a manual review of the diff." };
  }
}
