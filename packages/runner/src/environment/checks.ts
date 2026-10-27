import type { Sandbox } from "@hobai/sandbox";
import type { Check, CheckResult, CheckStatus } from "@hobai/shared";
import { lastLines, runLogged, type LoggedRun } from "../lib/run-logged.js";

export const CHECK_TIMEOUT_MS = 10 * 60_000;
const OUTPUT_TAIL_LINES = 30;
const COMMAND_MISSING =
  /command not found|Missing script|ERR_PNPM_NO_SCRIPT|Couldn't find a script named|error Command ".*" not found/i;

export function classify(
  run: Pick<LoggedRun, "ok" | "exitCode" | "timedOut" | "output">,
): CheckStatus {
  if (run.ok) return "passing";
  if (run.timedOut) return "timed-out";
  // 126/127: the command can't be executed or doesn't exist.
  if (run.exitCode === 126 || run.exitCode === 127) return "broken";
  if (COMMAND_MISSING.test(run.output)) return "broken";
  return "failing";
}

export function isUsable(status: CheckStatus) {
  return status === "passing" || status === "failing";
}

/** No check starts once `signal` is aborted; the results so far are returned. */
export async function runChecks(
  sandbox: Sandbox,
  checks: Check[],
  logPrefix: string,
  signal?: AbortSignal,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const [index, check] of checks.entries()) {
    if (signal?.aborted) break;
    const run = await runLogged(sandbox, check.command, {
      logName: `${logPrefix}-${index + 1}-${check.name}`,
      timeoutMs: CHECK_TIMEOUT_MS,
      cwd: check.cwd,
    });
    const status = classify(run);
    results.push({
      ...check,
      status,
      durationMs: run.durationMs,
      logPath: run.logPath,
      ...(status === "passing"
        ? {}
        : { outputTail: lastLines(run.output, OUTPUT_TAIL_LINES) }),
    });
  }
  return results;
}
