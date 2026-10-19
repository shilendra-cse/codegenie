import type { ResolvedModel } from "@codegenie/agent";
import type { EnvironmentConfig } from "@codegenie/shared";
import { ensureEnvironment } from "../suite/environments.js";
import type { EvalTask } from "../suite/tasks.js";
import { runTask, type TaskResult } from "./run-task.js";

export type RunEvalsOptions = {
  tasks: EvalTask[];
  model: ResolvedModel;
  repeat: number;
  concurrency: number;
  refreshEnvironments: boolean;
  resultsDir: string;
  log: (message: string) => void;
};

export async function runEvals(
  options: RunEvalsOptions,
): Promise<TaskResult[]> {
  const { tasks, log } = options;

  // One onboarding per repository, before any task runs.
  const environments = new Map<string, EnvironmentConfig>();
  for (const task of tasks) {
    if (environments.has(task.repo.name)) continue;
    environments.set(
      task.repo.name,
      await ensureEnvironment(task.repo, {
        model: options.model,
        refresh: options.refreshEnvironments,
        log,
      }),
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
      const name = options.repeat > 1 ? `${task.id} #${attempt}` : task.id;
      log(`▶ ${name}`);
      const result = await runTask(task, {
        attempt,
        model: options.model,
        environment: environments.get(task.repo.name),
        resultsDir: options.resultsDir,
      });
      results[index] = result;
      log(
        `${result.solved === null ? "?" : result.solved ? "✓" : "✗"} ${name} (${Math.round(result.durationMs / 1000)}s, $${(result.agent?.costUsd ?? 0).toFixed(4)})`,
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, queue.length) }, worker),
  );
  return results;
}
