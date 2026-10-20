import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Emit, ResolvedModel } from "@codegenie/agent";
import { runTask, type RunResult } from "@codegenie/runner";
import { DockerSandbox, type Sandbox } from "@codegenie/sandbox";
import type { EnvironmentConfig } from "@codegenie/shared";
import { grade, type Grade } from "../graders/grade.js";
import { pinCommit, repoSource } from "../suite/repos.js";
import type { EvalTask } from "../suite/tasks.js";

const PATCH_FILE = ".codegenie-eval.patch";

export type TaskResult = {
  id: string;
  attempt: number;
  /** Graded as passed with no regressed checks; null when it needs a manual review. */
  solved: boolean | null;
  grade: Grade;
  run: Pick<RunResult, "status" | "failedStage" | "error">;
  checks: { fixed: number; regressions: number; failing: number } | null;
  agent: {
    status: string;
    steps: number;
    costUsd: number;
    summary: string | null;
  } | null;
  durationMs: number;
  /** Where the agent's diff was saved, when it changed anything. */
  diffFile?: string;
};

async function applyPatch(sandbox: Sandbox, task: EvalTask) {
  if (!task.patch) return;
  await sandbox.writeFile(
    PATCH_FILE,
    await readFile(path.join(task.dir, task.patch), "utf8"),
  );
  const result = await sandbox.exec(
    `git apply ${PATCH_FILE} && rm ${PATCH_FILE}`,
  );
  if (result.exitCode !== 0) {
    throw new Error(`The task's patch doesn't apply: ${result.stderr.trim()}`);
  }
}

/** Base name for a task attempt's files in the results folder. */
export function artifactName(taskId: string, attempt: number) {
  return `${taskId.replace("/", "--")}-${attempt}`;
}

export function solvedFrom(result: Grade, run: RunResult): boolean | null {
  if (result.passed === null) return null;
  return result.passed && (run.verify?.regressions ?? 0) === 0;
}

export async function runEvalTask(
  task: EvalTask,
  options: {
    attempt: number;
    model: ResolvedModel;
    environment?: EnvironmentConfig;
    resultsDir: string;
    emit?: Emit;
    createSandbox?: () => Promise<Sandbox>;
  },
): Promise<TaskResult> {
  const startedAt = Date.now();
  const create = options.createSandbox ?? (() => DockerSandbox.create());
  let sandbox: Sandbox | undefined;

  const run = await runTask({
    runId: `eval-${task.id.replace("/", "-")}-${options.attempt}`,
    task: task.task,
    source: repoSource(task.repo),
    model: options.model,
    environment: options.environment,
    emit: options.emit,
    limits: {
      ...(task.limits?.maxSteps ? { maxSteps: task.limits.maxSteps } : {}),
      ...(task.limits?.maxCostUsd
        ? { maxCostUsd: task.limits.maxCostUsd }
        : {}),
      ...(task.limits?.maxMinutes
        ? { maxWallTimeMs: task.limits.maxMinutes * 60_000 }
        : {}),
    },
    keepSandbox: true,
    createSandbox: async () => (sandbox = await create()),
    afterCheckout: async (box) => {
      await pinCommit(box, task.repo);
      await applyPatch(box, task);
    },
  });

  let result: Grade;
  try {
    result = sandbox
      ? await grade(task, sandbox, run)
      : { passed: false, detail: run.error ?? "No sandbox was created." };
  } finally {
    await sandbox?.destroy().catch(() => {});
  }

  let diffFile: string | undefined;
  if (run.diff?.patch) {
    diffFile = path.join(
      options.resultsDir,
      `${artifactName(task.id, options.attempt)}.patch`,
    );
    await writeFile(diffFile, run.diff.patch);
  }

  const verify = run.verify;
  return {
    id: task.id,
    attempt: options.attempt,
    solved: solvedFrom(result, run),
    grade: result,
    run: { status: run.status, failedStage: run.failedStage, error: run.error },
    checks: verify
      ? {
          fixed: verify.fixed,
          regressions: verify.regressions,
          failing: verify.checks.filter((c) => c.status !== "passing").length,
        }
      : null,
    agent: run.agent
      ? {
          status: run.agent.status,
          steps: run.agent.steps,
          costUsd: run.agent.usage.costUsd,
          summary: run.agent.summary,
        }
      : null,
    durationMs: Date.now() - startedAt,
    diffFile,
  };
}
