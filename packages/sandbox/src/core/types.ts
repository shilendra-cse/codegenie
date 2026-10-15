/** Directory inside every sandbox where the repository lives. Relative paths resolve against it. */
export const WORKSPACE_DIR = "/workspace";

/** Where full command output is saved inside a sandbox, outside the repository. */
export const SANDBOX_LOG_DIR = "/tmp/codegenie/logs";

export type ExecOptions = {
  /** Working directory inside the sandbox. Default: WORKSPACE_DIR. */
  cwd?: string;
  /** Default 2 minutes, capped at 10 minutes. */
  timeoutMs?: number;
  env?: Record<string, string>;
};

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** The command was killed because it exceeded its timeout. */
  timedOut: boolean;
  /** stdout or stderr exceeded the 1 MB cap; head and tail were kept. */
  truncated: boolean;
};

export type FileEntry = {
  /** Absolute path inside the sandbox. */
  path: string;
  isDirectory: boolean;
  /** Size in bytes (0 for directories). */
  size: number;
};

export type ListFilesOptions = {
  /** Default 2. */
  maxDepth?: number;
};

/**
 * An isolated environment the agent's tools run against.
 * Implementations: DockerSandbox (local), DaytonaSandbox (phase 2).
 * A failing command is a normal ExecResult; only infrastructure problems throw.
 */
export interface Sandbox {
  readonly id: string;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string, options?: ListFilesOptions): Promise<FileEntry[]>;
  /** Safe to call more than once. */
  destroy(): Promise<void>;
}

export type SandboxResources = {
  /** Default 2. */
  cpus?: number;
  /** Default 4. */
  memoryGb?: number;
};

export type CreateSandboxOptions = {
  provider: "docker";
  resources?: SandboxResources;
};
