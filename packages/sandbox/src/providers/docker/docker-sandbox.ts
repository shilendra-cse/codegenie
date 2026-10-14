import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  SandboxCreateError,
  SandboxError,
  SandboxFileError,
  SandboxGoneError,
  SandboxUnavailableError,
} from "../../core/errors.js";
import {
  WORKSPACE_DIR,
  type ExecOptions,
  type ExecResult,
  type FileEntry,
  type ListFilesOptions,
  type Sandbox,
  type SandboxResources,
} from "../../core/types.js";
import { runProcess, type RunProcessResult } from "../../lib/run-process.js";
import {
  COPY_IN_TIMEOUT_MS,
  DEFAULT_CPUS,
  DEFAULT_EXEC_TIMEOUT_MS,
  DEFAULT_IMAGE,
  DEFAULT_MEMORY_GB,
  HOST_TIMEOUT_MARGIN_MS,
  KILL_GRACE_SECONDS,
  MAX_EXEC_TIMEOUT_MS,
  MAX_LIFETIME_SECONDS,
  MAX_READ_FILE_BYTES,
  PIDS_LIMIT,
  SANDBOX_LABEL,
} from "./constants.js";
import { docker, isContainerGone } from "./docker-cli.js";

export type DockerSandboxOptions = {
  resources?: SandboxResources;
  /** Image to start from. Default: codegenie-base. */
  image?: string;
};

function resolveInSandbox(p: string) {
  return path.posix.resolve(WORKSPACE_DIR, p);
}

export class DockerSandbox implements Sandbox {
  private destroyed = false;

  private constructor(public readonly id: string) {}

  static async create(
    options: DockerSandboxOptions = {},
  ): Promise<DockerSandbox> {
    const image = options.image ?? DEFAULT_IMAGE;
    const cpus = options.resources?.cpus ?? DEFAULT_CPUS;
    const memoryGb = options.resources?.memoryGb ?? DEFAULT_MEMORY_GB;

    let version: RunProcessResult;
    try {
      version = await docker(["version", "--format", "{{.Server.Version}}"]);
    } catch {
      throw new SandboxUnavailableError(
        "Docker CLI not found. Install Docker Desktop and make sure `docker` is on your PATH.",
      );
    }
    if (version.code !== 0) {
      throw new SandboxUnavailableError(
        "Docker is not running. Start Docker Desktop and try again.",
      );
    }

    const inspect = await docker(["image", "inspect", image]);
    if (inspect.code !== 0) {
      throw new SandboxUnavailableError(
        `Sandbox image "${image}" not found. Build it with: pnpm sandbox:build-image`,
      );
    }

    const id = `cg-${randomBytes(4).toString("hex")}`;
    const run = await docker([
      "run",
      "--detach",
      "--init",
      "--name",
      id,
      "--label",
      SANDBOX_LABEL,
      "--memory",
      `${memoryGb}g`,
      "--cpus",
      String(cpus),
      "--pids-limit",
      String(PIDS_LIMIT),
      image,
      "sleep",
      String(MAX_LIFETIME_SECONDS),
    ]);
    if (run.code !== 0) {
      throw new SandboxCreateError(
        `Failed to start sandbox container: ${run.stderr.trim()}`,
      );
    }

    return new DockerSandbox(id);
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    this.assertAlive();
    const timeoutMs = Math.min(
      options.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS,
      MAX_EXEC_TIMEOUT_MS,
    );
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const envArgs = Object.entries(options.env ?? {}).flatMap(([k, v]) => [
      "-e",
      `${k}=${v}`,
    ]);

    // The timeout is enforced inside the container: killing the docker CLI on the
    // host would leave the command running in the container.
    const started = Date.now();
    const result = await runProcess(
      "docker",
      [
        "exec",
        "-w",
        options.cwd ? resolveInSandbox(options.cwd) : WORKSPACE_DIR,
        ...envArgs,
        this.id,
        "timeout",
        "-k",
        `${KILL_GRACE_SECONDS}s`,
        `${timeoutSeconds}s`,
        "bash",
        "-lc",
        command,
      ],
      { timeoutMs: timeoutMs + HOST_TIMEOUT_MARGIN_MS },
    );

    this.throwIfGone(result);

    const elapsed = Date.now() - started;
    // 124: `timeout` sent SIGTERM; 137: it had to SIGKILL after the grace period.
    const timedOut =
      result.killed ||
      result.code === 124 ||
      (result.code === 137 && elapsed >= timeoutMs);

    return {
      exitCode: result.code ?? -1,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut,
      truncated: result.truncated,
    };
  }

  async readFile(filePath: string): Promise<string> {
    this.assertAlive();
    const abs = resolveInSandbox(filePath);
    const result = await docker(["exec", this.id, "cat", "--", abs], {
      maxOutputBytes: MAX_READ_FILE_BYTES,
    });
    this.throwIfGone(result);
    if (result.code !== 0) {
      throw new SandboxFileError(
        result.stderr.trim() || `Cannot read ${abs}`,
        abs,
      );
    }
    if (result.truncated) {
      throw new SandboxFileError(
        `${abs} is larger than ${MAX_READ_FILE_BYTES} bytes`,
        abs,
      );
    }
    return result.stdout;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.assertAlive();
    const abs = resolveInSandbox(filePath);
    // Content goes through stdin, never into the command line: no quoting or injection issues.
    const result = await docker(
      [
        "exec",
        "-i",
        this.id,
        "sh",
        "-c",
        'mkdir -p "$(dirname "$1")" && cat > "$1"',
        "sh",
        abs,
      ],
      { input: content },
    );
    this.throwIfGone(result);
    if (result.code !== 0) {
      throw new SandboxFileError(
        result.stderr.trim() || `Cannot write ${abs}`,
        abs,
      );
    }
  }

  async listFiles(
    dirPath: string,
    options: ListFilesOptions = {},
  ): Promise<FileEntry[]> {
    this.assertAlive();
    const abs = resolveInSandbox(dirPath);
    const result = await docker([
      "exec",
      this.id,
      "find",
      abs,
      "-mindepth",
      "1",
      "-maxdepth",
      String(options.maxDepth ?? 2),
      "(",
      "-name",
      "node_modules",
      "-o",
      "-name",
      ".git",
      ")",
      "-prune",
      "-o",
      "-printf",
      "%y\t%s\t%p\n",
    ]);
    this.throwIfGone(result);
    if (result.code !== 0) {
      throw new SandboxFileError(
        result.stderr.trim() || `Cannot list ${abs}`,
        abs,
      );
    }

    return result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [type, size, ...rest] = line.split("\t");
        const isDirectory = type === "d";
        return {
          path: rest.join("\t"),
          isDirectory,
          size: isDirectory ? 0 : Number(size),
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Docker-only: copy a local directory's contents into /workspace.
   * Not on the Sandbox interface because remote sandboxes (Daytona) clone from GitHub instead.
   */
  async copyIn(localDir: string): Promise<void> {
    this.assertAlive();
    const source = `${path.resolve(localDir)}/.`;
    const cp = await docker(["cp", source, `${this.id}:${WORKSPACE_DIR}`], {
      timeoutMs: COPY_IN_TIMEOUT_MS,
    });
    this.throwIfGone(cp);
    if (cp.code !== 0) {
      throw new SandboxError(
        `Failed to copy ${localDir} into sandbox: ${cp.stderr.trim()}`,
      );
    }
    // docker cp creates root-owned files; hand them to the agent user.
    const chown = await docker([
      "exec",
      "-u",
      "root",
      this.id,
      "chown",
      "-R",
      "agent:agent",
      WORKSPACE_DIR,
    ]);
    if (chown.code !== 0) {
      throw new SandboxError(
        `Failed to set workspace ownership: ${chown.stderr.trim()}`,
      );
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    // `rm -f` also succeeds-or-reports-missing for an already removed container; either is fine.
    await docker(["rm", "-f", this.id]);
  }

  private assertAlive() {
    if (this.destroyed) {
      throw new SandboxGoneError(`Sandbox ${this.id} has been destroyed`);
    }
  }

  private throwIfGone(result: RunProcessResult) {
    if (isContainerGone(result)) {
      this.destroyed = true;
      throw new SandboxGoneError(`Sandbox ${this.id} no longer exists`);
    }
  }
}
