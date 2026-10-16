import type { Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "../../lib/shell-quote.js";
import { LOG_DIR } from "./workspace-path.js";

export class OutputLog {
  private count = 0;

  nextPath(label: string) {
    this.count += 1;
    return `${LOG_DIR}/${String(this.count).padStart(4, "0")}-${label}.log`;
  }
}

// pipefail keeps the command's exit code through tee; the newline before } stops a trailing # comment from swallowing it.
export function wrapWithLog(command: string, logPath: string) {
  return `mkdir -p ${shellQuote(LOG_DIR)} && set -o pipefail && { ${command}\n} 2>&1 | tee ${shellQuote(logPath)}`;
}

export async function logSize(sandbox: Sandbox, logPath: string) {
  const result = await sandbox.exec(`wc -c < ${shellQuote(logPath)}`);
  const bytes = Number(result.stdout.trim());
  if (result.exitCode !== 0 || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
