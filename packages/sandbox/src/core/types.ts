export const WORKSPACE_DIR = "/workspace";

export const SANDBOX_LOG_DIR = "/tmp/codegenie/logs";

export type ExecOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
};

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
};

export type FileEntry = {
  path: string;
  isDirectory: boolean;
  size: number;
};

export type ListFilesOptions = {
  maxDepth?: number;
};

export interface Sandbox {
  readonly id: string;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string, options?: ListFilesOptions): Promise<FileEntry[]>;
  destroy(): Promise<void>;
}

export type SandboxResources = {
  cpus?: number;
  memoryGb?: number;
};

export type CreateSandboxOptions = {
  provider: "docker";
  resources?: SandboxResources;
};
