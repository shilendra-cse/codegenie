import type { Sandbox } from "@codegenie/sandbox";
import type { Check } from "@codegenie/shared";
import { lastLines, runLogged } from "../../lib/run-logged.js";

const CHECK_TIMEOUT_MS = 10 * 60_000;
const OUTPUT_TAIL_LINES = 30;

export type CheckOutcome = Check & {
  passed: boolean;
  timedOut: boolean;
  exitCode: number;
  durationMs: number;
  logPath: string;
  outputTail?: string;
};

export async function runVerify(
  sandbox: Sandbox,
  checks: Check[],
): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  for (const [index, check] of checks.entries()) {
    const run = await runLogged(sandbox, check.command, {
      logName: `verify-${index + 1}-${check.name}`,
      timeoutMs: CHECK_TIMEOUT_MS,
      cwd: check.cwd,
    });
    outcomes.push({
      ...check,
      passed: run.ok,
      timedOut: run.timedOut,
      exitCode: run.exitCode,
      durationMs: run.durationMs,
      logPath: run.logPath,
      ...(run.ok
        ? {}
        : { outputTail: lastLines(run.output, OUTPUT_TAIL_LINES) }),
    });
  }
  return outcomes;
}
