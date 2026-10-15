import type { Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "../../lib/shell-quote.js";
import { LOG_DIR } from "./workspace-path.js";

/** Hands out numbered log file paths for one agent run: 0001-bash.log, 0002-check-test.log… */
export class OutputLog {
  private count = 0;

  nextPath(label: string) {
    this.count += 1;
    return `${LOG_DIR}/${String(this.count).padStart(4, "0")}-${label}.log`;
  }
}

/**
 * Wraps a shell command so its combined stdout+stderr is also written, in full, to `logPath`
 * inside the sandbox. `pipefail` keeps the command's own exit code. The newline before `}`
 * keeps the group intact even if the command ends with a comment.
 */
export function wrapWithLog(command: string, logPath: string) {
  return `mkdir -p ${shellQuote(LOG_DIR)} && set -o pipefail && { ${command}\n} 2>&1 | tee ${shellQuote(logPath)}`;
}

/** Human-readable size of a saved log, or null if it can't be read. */
export async function logSize(sandbox: Sandbox, logPath: string) {
  const result = await sandbox.exec(`wc -c < ${shellQuote(logPath)}`);
  const bytes = Number(result.stdout.trim());
  if (result.exitCode !== 0 || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
