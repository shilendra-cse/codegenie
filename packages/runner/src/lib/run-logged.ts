import { SANDBOX_LOG_DIR, type Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "./shell-quote.js";

export type LoggedRun = {
  ok: boolean;
  exitCode: number;
  timedOut: boolean;
  output: string;
  logPath: string;
  durationMs: number;
};

export async function runLogged(
  sandbox: Sandbox,
  command: string,
  options: { logName: string; timeoutMs: number; cwd?: string },
): Promise<LoggedRun> {
  const logPath = `${SANDBOX_LOG_DIR}/${options.logName}.log`;
  // pipefail keeps the command's exit code through tee; the newline before } stops a trailing # comment from swallowing it.
  const wrapped = `mkdir -p ${shellQuote(SANDBOX_LOG_DIR)} && set -o pipefail && { ${command}\n} 2>&1 | tee ${shellQuote(logPath)}`;
  const started = Date.now();
  const result = await sandbox.exec(wrapped, {
    timeoutMs: options.timeoutMs,
    cwd: options.cwd,
  });
  return {
    ok: result.exitCode === 0 && !result.timedOut,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    logPath,
    durationMs: Date.now() - started,
  };
}

export function lastLines(output: string, count: number) {
  return output.trimEnd().split("\n").slice(-count).join("\n");
}
