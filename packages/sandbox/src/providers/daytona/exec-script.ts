import { KILL_GRACE_SECONDS } from "../../core/limits.js";

export const COMMAND_ENV = "CG_CMD";

// Daytona returns stdout and stderr mixed together, so stderr goes to a file and comes back after a marker.
export function execScript(marker: string, timeoutSeconds: number) {
  return [
    'err="$(mktemp)"',
    `timeout -k ${KILL_GRACE_SECONDS}s ${timeoutSeconds}s bash -lc "$${COMMAND_ENV}" 2>"$err"`,
    "code=$?",
    `printf '\\n${marker} %d\\n' "$code"`,
    'cat "$err"',
    'rm -f "$err"',
  ].join("; ");
}

export function parseExecOutput(output: string, marker: string) {
  const at = output.lastIndexOf(`\n${marker} `);
  if (at === -1) return null;
  const rest = output.slice(at + marker.length + 2);
  const newline = rest.indexOf("\n");
  const exitCode = Number(rest.slice(0, newline === -1 ? undefined : newline));
  if (!Number.isInteger(exitCode)) return null;
  return {
    stdout: output.slice(0, at),
    exitCode,
    stderr: newline === -1 ? "" : rest.slice(newline + 1),
  };
}
