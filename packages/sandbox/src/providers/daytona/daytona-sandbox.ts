import { randomBytes } from "node:crypto";
import {
  Daytona,
  DaytonaAuthenticationError,
  DaytonaError,
  DaytonaFileNotFoundError,
  DaytonaForbiddenError,
  DaytonaNotFoundError,
  DaytonaProcessExecutionTimeoutError,
  type CreateSandboxFromSnapshotParams,
} from "@daytonaio/sdk";
import {
  SandboxCreateError,
  SandboxError,
  SandboxFileError,
  SandboxGoneError,
  SandboxUnavailableError,
} from "../../core/errors.js";
import {
  DEFAULT_EXEC_TIMEOUT_MS,
  KILL_GRACE_SECONDS,
  MAX_EXEC_TIMEOUT_MS,
  MAX_LIFETIME_SECONDS,
  MAX_READ_FILE_BYTES,
} from "../../core/limits.js";
import {
  WORKSPACE_DIR,
  type ExecOptions,
  type ExecResult,
  type FileEntry,
  type ListFilesOptions,
  type Sandbox,
} from "../../core/types.js";
import { CappedBuffer } from "../../lib/capped-buffer.js";
import { findArgs, parseFindOutput } from "../../lib/find-files.js";
import { MAX_OUTPUT_BYTES } from "../../lib/run-process.js";
import { resolveInWorkspace } from "../../lib/workspace.js";
import {
  AUTO_STOP_MINUTES,
  CREATE_TIMEOUT_SECONDS,
  DEFAULT_SNAPSHOT,
  FILE_TIMEOUT_SECONDS,
  SANDBOX_LABELS,
  SDK_TIMEOUT_MARGIN_SECONDS,
} from "./constants.js";
import { COMMAND_ENV, execScript, parseExecOutput } from "./exec-script.js";

/** The part of a Daytona sandbox this provider uses. */
export type RemoteSandbox = {
  id: string;
  process: {
    executeCommand(
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      timeout?: number,
    ): Promise<{ exitCode: number; result: string }>;
  };
  fs: {
    downloadFile(remotePath: string, timeout?: number): Promise<Buffer>;
    uploadFile(
      file: Buffer,
      remotePath: string,
      timeout?: number,
    ): Promise<void>;
  };
  delete(timeout?: number): Promise<void>;
};

export type DaytonaClient = {
  create(
    params: CreateSandboxFromSnapshotParams,
    options?: { timeout?: number },
  ): Promise<RemoteSandbox>;
};

export type DaytonaSandboxOptions = {
  /** Defaults to a client from DAYTONA_API_KEY / DAYTONA_API_URL / DAYTONA_TARGET. */
  client?: DaytonaClient;
  snapshot?: string;
  labels?: Record<string, string>;
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

function capped(text: string) {
  const buffer = new CappedBuffer(MAX_OUTPUT_BYTES);
  buffer.push(Buffer.from(text));
  return { text: buffer.toString(), truncated: buffer.truncated };
}

export class DaytonaSandbox implements Sandbox {
  private destroyed = false;

  private constructor(private readonly remote: RemoteSandbox) {}

  get id() {
    return this.remote.id;
  }

  static async create(
    options: DaytonaSandboxOptions = {},
  ): Promise<DaytonaSandbox> {
    let client = options.client;
    if (!client) {
      try {
        client = new Daytona();
      } catch (error) {
        throw new SandboxUnavailableError(
          `Daytona isn't configured: ${messageOf(error)}`,
        );
      }
    }

    try {
      const remote = await client.create(
        {
          snapshot: options.snapshot ?? DEFAULT_SNAPSHOT,
          labels: { ...SANDBOX_LABELS, ...options.labels },
          ephemeral: true,
          ttlMinutes: MAX_LIFETIME_SECONDS / 60,
          autoStopInterval: AUTO_STOP_MINUTES,
        },
        { timeout: CREATE_TIMEOUT_SECONDS },
      );
      return new DaytonaSandbox(remote);
    } catch (error) {
      if (
        error instanceof DaytonaAuthenticationError ||
        error instanceof DaytonaForbiddenError
      ) {
        throw new SandboxUnavailableError(
          `Daytona rejected the API key: ${error.message}`,
        );
      }
      throw new SandboxCreateError(
        `Failed to create a Daytona sandbox: ${messageOf(error)}`,
      );
    }
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    this.assertAlive();
    const timeoutMs = Math.min(
      options.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS,
      MAX_EXEC_TIMEOUT_MS,
    );
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const marker = `__codegenie_${randomBytes(8).toString("hex")}__`;

    const started = Date.now();
    let response: { exitCode: number; result: string };
    try {
      response = await this.remote.process.executeCommand(
        execScript(marker, timeoutSeconds),
        options.cwd ? resolveInWorkspace(options.cwd) : WORKSPACE_DIR,
        { ...options.env, [COMMAND_ENV]: command },
        timeoutSeconds + KILL_GRACE_SECONDS + SDK_TIMEOUT_MARGIN_SECONDS,
      );
    } catch (error) {
      if (error instanceof DaytonaProcessExecutionTimeoutError) {
        return {
          exitCode: -1,
          stdout: "",
          stderr: `Timed out after ${timeoutSeconds}s`,
          timedOut: true,
          truncated: false,
        };
      }
      throw this.translate(error);
    }

    const parsed = parseExecOutput(response.result, marker) ?? {
      exitCode: response.exitCode,
      stdout: "",
      stderr: response.result,
    };
    const stdout = capped(parsed.stdout);
    const stderr = capped(parsed.stderr);
    const elapsed = Date.now() - started;
    return {
      exitCode: parsed.exitCode,
      stdout: stdout.text,
      stderr: stderr.text,
      timedOut:
        parsed.exitCode === 124 ||
        (parsed.exitCode === 137 && elapsed >= timeoutMs),
      truncated: stdout.truncated || stderr.truncated,
    };
  }

  async readFile(filePath: string): Promise<string> {
    this.assertAlive();
    const abs = resolveInWorkspace(filePath);
    let content: Buffer;
    try {
      content = await this.remote.fs.downloadFile(abs, FILE_TIMEOUT_SECONDS);
    } catch (error) {
      throw this.translate(error, abs);
    }
    // Refuse rather than truncate: an edit written back from partial content would corrupt the file.
    if (content.length > MAX_READ_FILE_BYTES) {
      throw new SandboxFileError(
        `${abs} is larger than ${MAX_READ_FILE_BYTES} bytes`,
        abs,
      );
    }
    return content.toString("utf8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.assertAlive();
    const abs = resolveInWorkspace(filePath);
    try {
      await this.remote.fs.uploadFile(
        Buffer.from(content),
        abs,
        FILE_TIMEOUT_SECONDS,
      );
    } catch (error) {
      throw this.translate(error, abs);
    }
  }

  async listFiles(
    dirPath: string,
    options: ListFilesOptions = {},
  ): Promise<FileEntry[]> {
    const abs = resolveInWorkspace(dirPath);
    const find = ["find", ...findArgs(abs, options.maxDepth ?? 2)]
      .map(shellQuote)
      .join(" ");
    const result = await this.exec(find);
    if (result.exitCode !== 0) {
      throw new SandboxFileError(
        result.stderr.trim() || `Cannot list ${abs}`,
        abs,
      );
    }
    return parseFindOutput(result.stdout);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      await this.remote.delete();
    } catch (error) {
      if (error instanceof DaytonaNotFoundError) return;
      throw new SandboxError(
        `Failed to delete Daytona sandbox ${this.id}: ${messageOf(error)}`,
      );
    }
  }

  private assertAlive() {
    if (this.destroyed) {
      throw new SandboxGoneError(`Sandbox ${this.id} has been destroyed`);
    }
  }

  private translate(error: unknown, filePath?: string): unknown {
    if (filePath && error instanceof DaytonaFileNotFoundError) {
      return new SandboxFileError(`${filePath} doesn't exist`, filePath);
    }
    if (error instanceof DaytonaNotFoundError) {
      this.destroyed = true;
      return new SandboxGoneError(`Sandbox ${this.id} no longer exists`);
    }
    if (filePath && error instanceof DaytonaError) {
      return new SandboxFileError(error.message, filePath);
    }
    return error;
  }
}
