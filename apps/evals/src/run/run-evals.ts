import { createWriteStream } from "node:fs";
import path from "node:path";
import type { ResolvedModel } from "@hobai/agent";
import type { EnvironmentConfig } from "@hobai/shared";
import { createRunReporter, plain } from "@hobai/terminal";
import { ensureEnvironment } from "../suite/environments.js";
import type { EvalTask } from "../suite/tasks.js";
import type { EvalProgress } from "./progress.js";
import { artifactName, runEvalTask, type TaskResult } from "./run-eval-task.js";

export type RunEvalsOptions = {
  tasks: EvalTask[];
  model: ResolvedModel;
  repeat: number;
  concurrency: number;
  refreshEnvironments: boolean;
  resultsDir: string;
  progress: EvalProgress;
};

/** Name shown for an attempt: the task id, numbered when tasks repeat. */
export const attemptName = (task: EvalTask, attempt: number, repeat: number) =>
  repeat > 1 ? `${task.id} #${attempt}` : task.id;

async function runLogged(
  task: EvalTask,
  attempt: number,
  options: RunEvalsOptions,
  environment: EnvironmentConfig | undefined,
): Promise<TaskResult> {
  const name = attemptName(task, attempt, options.repeat);
  const logFile = path.join(
    options.resultsDir,
    `${artifactName(task.id, attempt)}.log`,
  );
  const log = createWriteStream(logFile);
  const reporter = createRunReporter((line) => log.write(`${line}\n`), plain);
  log.write(`${name}\nTask: ${task.task}\n\n`);
  options.progress.taskStarted(name, logFile);

  try {
    const result = await runEvalTask(task, {
      attempt,
      model: options.model,
      environment,
      resultsDir: options.resultsDir,
      emit: (event) => {
        reporter.onEvent(event);
        options.progress.taskEvent(name, event);
      },
    });
    reporter.flush();
    log.write(
      `\nSolved: ${result.solved === null ? "needs review" : result.solved ? "yes" : "no"}\n${result.grade.detail}\n`,
    );
    options.progress.taskFinished(name, result);
    return result;
  } finally {
    await new Promise((resolve) => log.end(resolve));
  }
}

export async function runEvals(
  options: RunEvalsOptions,
): Promise<TaskResult[]> {
  const { tasks, progress } = options;

  // One onboarding per repository, before any task runs.
  const environments = new Map<string, EnvironmentConfig>();
  for (const task of tasks) {
    if (environments.has(task.repo.name)) continue;
    let finish: (() => void) | null = null;
    environments.set(
      task.repo.name,
      await ensureEnvironment(task.repo, {
        model: options.model,
        refresh: options.refreshEnvironments,
        log: (message) => {
          progress.info(message);
          finish ??= progress.activity(task.repo.name, "onboarding");
        },
      }).finally(() => finish?.()),
    );
  }

  const queue = tasks.flatMap((task) =>
    Array.from({ length: options.repeat }, (_, i) => ({
      task,
      attempt: i + 1,
    })),
  );
  const results: TaskResult[] = new Array(queue.length);
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const index = next++;
      const { task, attempt } = queue[index]!;
      results[index] = await runLogged(
        task,
        attempt,
        options,
        environments.get(task.repo.name),
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, queue.length) }, worker),
  );
  return results;
}
