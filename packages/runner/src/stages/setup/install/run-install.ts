import { SANDBOX_LOG_DIR, type Sandbox } from "@codegenie/sandbox";
import type { InstallResult } from "@codegenie/shared";
import { shellQuote } from "../../../lib/shell-quote.js";
import type { InstallPlan } from "../core/detector.js";

export const INSTALL_TIMEOUT_MS = 10 * 60_000;
const ERROR_TAIL_LINES = 40;

type Attempt = { ok: boolean; output: string; logPath: string };

async function attempt(
  sandbox: Sandbox,
  command: string,
  logPath: string,
): Promise<Attempt> {
  const wrapped = `mkdir -p ${shellQuote(SANDBOX_LOG_DIR)} && set -o pipefail && { ${command}\n} 2>&1 | tee ${shellQuote(logPath)}`;
  const result = await sandbox.exec(wrapped, { timeoutMs: INSTALL_TIMEOUT_MS });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const timedOut = result.timedOut
    ? `\n[install timed out after ${INSTALL_TIMEOUT_MS / 60_000} minutes]`
    : "";
  return {
    ok: result.exitCode === 0 && !result.timedOut,
    output: output + timedOut,
    logPath,
  };
}

function tail(output: string) {
  return output.trimEnd().split("\n").slice(-ERROR_TAIL_LINES).join("\n");
}

export async function runInstall(
  sandbox: Sandbox,
  plan: InstallPlan | null,
): Promise<InstallResult> {
  const started = Date.now();
  if (!plan) {
    return { command: null, status: "skipped", durationMs: 0 };
  }

  const first = await attempt(
    sandbox,
    plan.frozen,
    `${SANDBOX_LOG_DIR}/setup-install.log`,
  );
  if (first.ok) {
    return {
      command: plan.frozen,
      status: "ok",
      durationMs: Date.now() - started,
      logPath: first.logPath,
    };
  }

  if (plan.fallback) {
    const second = await attempt(
      sandbox,
      plan.fallback,
      `${SANDBOX_LOG_DIR}/setup-install-retry.log`,
    );
    return {
      command: plan.fallback,
      status: second.ok ? "ok-after-retry" : "failed",
      durationMs: Date.now() - started,
      logPath: second.logPath,
      ...(second.ok ? {} : { errorTail: tail(second.output) }),
    };
  }

  return {
    command: plan.frozen,
    status: "failed",
    durationMs: Date.now() - started,
    logPath: first.logPath,
    errorTail: tail(first.output),
  };
}
