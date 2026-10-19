import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Sandbox } from "@codegenie/sandbox";
import type { EvalTask, TaskGrader } from "../suite/tasks.js";
import type { Grade } from "./grade.js";

const TIMEOUT_MS = 10 * 60_000;
const OUTPUT_LINES = 30;

const lastLines = (text: string) =>
  text.trimEnd().split("\n").slice(-OUTPUT_LINES).join("\n");

/** Copies tests the agent never saw into the repository and runs them. */
export async function hiddenTests(
  task: EvalTask,
  grader: Extract<TaskGrader, { type: "hidden-tests" }>,
  sandbox: Sandbox,
): Promise<Grade> {
  for (const file of task.hiddenFiles) {
    await sandbox.writeFile(
      path.posix.join(grader.target, file),
      await readFile(path.join(task.dir, "hidden", file), "utf8"),
    );
  }
  const run = await sandbox.exec(`${grader.command} 2>&1`, {
    cwd: grader.cwd,
    timeoutMs: TIMEOUT_MS,
  });
  const output = lastLines(run.stdout + run.stderr);
  if (run.timedOut) {
    return { passed: false, detail: `Hidden tests timed out.\n${output}` };
  }
  return run.exitCode === 0
    ? { passed: true, detail: "Hidden tests passed." }
    : { passed: false, detail: `Hidden tests failed:\n${output}` };
}
