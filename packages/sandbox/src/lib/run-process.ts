import { spawn } from "node:child_process";
import { CappedBuffer } from "./capped-buffer.js";

export const MAX_OUTPUT_BYTES = 1024 * 1024;

export type RunProcessOptions = {
  /** Written to the process's stdin, then stdin is closed. */
  input?: string;
  /** Kill the process after this long. Undefined = no limit. */
  timeoutMs?: number;
  /** Per-stream capture limit. Default MAX_OUTPUT_BYTES. */
  maxOutputBytes?: number;
};

export type RunProcessResult = {
  /** Exit code, or null if the process was killed by a signal. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Killed by our host-side timeout. */
  killed: boolean;
  truncated: boolean;
};

/** Runs a process on the host and collects its output. Never throws for non-zero exits. */
export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<RunProcessResult> {
  const max = options.maxOutputBytes ?? MAX_OUTPUT_BYTES;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = new CappedBuffer(max);
    const stderr = new CappedBuffer(max);
    let killed = false;

    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            killed = true;
            child.kill("SIGKILL");
          }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        killed,
        truncated: stdout.truncated || stderr.truncated,
      });
    });

    // The process may exit before reading stdin (EPIPE); its exit code reports the real outcome.
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ?? "");
  });
}
