import type { Sandbox } from "@codegenie/sandbox";
import type { StepResult } from "@codegenie/shared";
import { lastLines, runLogged, type LoggedRun } from "../lib/run-logged.js";
import type { DraftStep } from "./draft/draft.js";

export const STEP_TIMEOUT_MS = 10 * 60_000;
const ERROR_TAIL_LINES = 40;

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function errorTail(run: LoggedRun) {
  const timedOut = run.timedOut
    ? `\n[timed out after ${STEP_TIMEOUT_MS / 60_000} minutes]`
    : "";
  return lastLines(run.output + timedOut, ERROR_TAIL_LINES);
}

export type ApplyOptions = {
  logPrefix?: string;
  /** A result to use instead of running the step, e.g. when it already succeeded. */
  reuse?: (step: DraftStep) => StepResult | undefined;
};

export async function applySteps(
  sandbox: Sandbox,
  steps: DraftStep[],
  options: ApplyOptions = {},
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const [index, step] of steps.entries()) {
    const reused = options.reuse?.(step);
    if (reused) {
      results.push(reused);
      continue;
    }
    const candidates = [step.command, ...(step.alternatives ?? [])];
    const started = Date.now();
    let last: { command: string; run: LoggedRun } | null = null;

    for (const [attempt, command] of candidates.entries()) {
      const run = await runLogged(sandbox, command, {
        logName: `${options.logPrefix ?? "setup"}-${index + 1}-${slug(step.name)}${attempt ? `-alt${attempt}` : ""}`,
        timeoutMs: STEP_TIMEOUT_MS,
        cwd: step.cwd,
      });
      last = { command, run };
      if (run.ok) break;
    }

    const { command, run } = last!;
    results.push({
      name: step.name,
      cwd: step.cwd,
      command,
      status: run.ok ? "ok" : "failed",
      durationMs: Date.now() - started,
      logPath: run.logPath,
      ...(run.ok ? {} : { errorTail: errorTail(run) }),
    });
  }
  return results;
}
