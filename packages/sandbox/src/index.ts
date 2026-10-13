// Sandbox abstraction the agent's tools run against (docs/knowledge/architecture.md §3).
// Implementations land in Phase 1 (DockerSandbox) and Phase 2 (DaytonaSandbox).

export type ExecOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
};

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type FileEntry = {
  path: string;
  isDirectory: boolean;
  size: number;
};

export interface Sandbox {
  readonly id: string;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<FileEntry[]>;
  /** Public URL for a port inside the sandbox (post-MVP: live previews). */
  previewUrl?(port: number): Promise<string>;
  destroy(): Promise<void>;
}

export type SandboxProvider = "docker" | "daytona";
