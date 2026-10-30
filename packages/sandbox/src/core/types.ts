export const WORKSPACE_DIR = "/workspace";

export const SANDBOX_TMP_DIR = `/tmp/${SHORT_NAME}`;

export const SANDBOX_LOG_DIR = `${SANDBOX_TMP_DIR}/logs`;

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

/** Lets the reaper find sandboxes whose run or onboarding is over. */
export type SandboxLabels = Record<string, string>;

export type DaytonaConnection = {
  apiKey: string;
  apiUrl?: string;
  target?: string;
};

export type E2BConnection = {
  apiKey: string;
};

export type CreateSandboxOptions =
  | { provider: "docker"; resources?: SandboxResources; labels?: SandboxLabels }
  | {
      provider: "daytona";
      connection: DaytonaConnection;
      labels?: SandboxLabels;
      retentionHours?: number;
    }
  | { provider: "e2b"; connection: E2BConnection; labels?: SandboxLabels };

export type ConnectSandboxOptions =
  | { provider: "docker"; id: string }
  | { provider: "daytona"; connection: DaytonaConnection; id: string }
  | { provider: "e2b"; connection: E2BConnection; id: string };
import { SHORT_NAME } from "@hobai/shared/brand";
