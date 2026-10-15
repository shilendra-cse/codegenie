import path from "node:path";
import { SandboxFileError } from "../core/errors.js";
import {
  WORKSPACE_DIR,
  type ExecOptions,
  type ExecResult,
  type FileEntry,
  type ListFilesOptions,
  type Sandbox,
} from "../core/types.js";

type ExecHandler = (
  command: string,
  options: ExecOptions,
) => Partial<ExecResult> | Promise<Partial<ExecResult>>;

/**
 * In-memory Sandbox for fast unit tests: files live in a Map, exec is scripted.
 * Mirrors DockerSandbox semantics (absolute paths, listFiles skipping node_modules/.git).
 */
export class FakeSandbox implements Sandbox {
  readonly id = "fake-sandbox";
  readonly files = new Map<string, string>();
  readonly execCalls: { command: string; options: ExecOptions }[] = [];
  execHandler: ExecHandler = () => ({});

  constructor(files: Record<string, string> = {}) {
    for (const [file, content] of Object.entries(files)) {
      this.files.set(this.resolve(file), content);
    }
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    this.execCalls.push({ command, options });
    const result = await this.execHandler(command, options);
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
      timedOut: false,
      truncated: false,
      ...result,
    };
  }

  async readFile(filePath: string): Promise<string> {
    const abs = this.resolve(filePath);
    const content = this.files.get(abs);
    if (content === undefined) {
      throw new SandboxFileError(`cat: ${abs}: No such file or directory`, abs);
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(this.resolve(filePath), content);
  }

  async listFiles(
    dirPath: string,
    options: ListFilesOptions = {},
  ): Promise<FileEntry[]> {
    const root = this.resolve(dirPath);
    const maxDepth = options.maxDepth ?? 2;
    const entries = new Map<string, FileEntry>();

    for (const [file, content] of this.files) {
      if (!file.startsWith(`${root}/`)) continue;
      const parts = file.slice(root.length + 1).split("/");
      if (parts.some((part) => part === "node_modules" || part === ".git")) {
        continue;
      }
      for (let depth = 1; depth <= Math.min(parts.length, maxDepth); depth++) {
        const entryPath = `${root}/${parts.slice(0, depth).join("/")}`;
        const isDirectory = depth < parts.length;
        entries.set(entryPath, {
          path: entryPath,
          isDirectory,
          size: isDirectory ? 0 : Buffer.byteLength(content),
        });
      }
    }
    return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async destroy(): Promise<void> {}

  private resolve(filePath: string) {
    return path.posix.resolve(WORKSPACE_DIR, filePath);
  }
}
