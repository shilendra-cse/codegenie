import type { Sandbox } from "@codegenie/sandbox";
import type { InstallResult } from "@codegenie/shared";
import {
  lastLines,
  runLogged,
  type LoggedRun,
} from "../../../lib/run-logged.js";
import type { InstallPlan } from "../core/detector.js";

export const INSTALL_TIMEOUT_MS = 10 * 60_000;
const ERROR_TAIL_LINES = 40;

function errorTail(run: LoggedRun) {
  const timedOut = run.timedOut
    ? `\n[install timed out after ${INSTALL_TIMEOUT_MS / 60_000} minutes]`
    : "";
  return lastLines(run.output + timedOut, ERROR_TAIL_LINES);
}

export async function runInstall(
  sandbox: Sandbox,
  plan: InstallPlan | null,
): Promise<InstallResult> {
  const started = Date.now();
  if (!plan) {
    return { command: null, status: "skipped", durationMs: 0 };
  }

  const first = await runLogged(sandbox, plan.frozen, {
    logName: "setup-install",
    timeoutMs: INSTALL_TIMEOUT_MS,
  });
  if (first.ok) {
    return {
      command: plan.frozen,
      status: "ok",
      durationMs: Date.now() - started,
      logPath: first.logPath,
    };
  }

  if (plan.fallback) {
    const second = await runLogged(sandbox, plan.fallback, {
      logName: "setup-install-retry",
      timeoutMs: INSTALL_TIMEOUT_MS,
    });
    return {
      command: plan.fallback,
      status: second.ok ? "ok-after-retry" : "failed",
      durationMs: Date.now() - started,
      logPath: second.logPath,
      ...(second.ok ? {} : { errorTail: errorTail(second) }),
    };
  }

  return {
    command: plan.frozen,
    status: "failed",
    durationMs: Date.now() - started,
    logPath: first.logPath,
    errorTail: errorTail(first),
  };
}
