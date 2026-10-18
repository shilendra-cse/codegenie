import path from "node:path";
import {
  SandboxFileError,
  WORKSPACE_DIR,
  type Sandbox,
} from "@codegenie/sandbox";

export type JsonRead<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "invalid"; error: string };

export type DirEntry = { name: string; isDirectory: boolean };

export class RepoReader {
  private dirs = new Map<string, Promise<DirEntry[]>>();

  constructor(private readonly sandbox: Sandbox) {}

  /** Entries directly inside a repository folder ("." is the root); empty if it doesn't exist. */
  entries(dir = "."): Promise<DirEntry[]> {
    const key = path.posix.normalize(dir);
    let cached = this.dirs.get(key);
    if (!cached) {
      const abs = path.posix.join(WORKSPACE_DIR, key);
      cached = this.sandbox.listFiles(abs, { maxDepth: 1 }).then(
        (entries) =>
          entries.map((e) => ({
            name: e.path.slice(abs.length + 1),
            isDirectory: e.isDirectory,
          })),
        (error: unknown) => {
          if (error instanceof SandboxFileError) return [];
          throw error;
        },
      );
      this.dirs.set(key, cached);
    }
    return cached;
  }

  async has(filePath: string) {
    const entries = await this.entries(path.posix.dirname(filePath));
    return entries.some((e) => e.name === path.posix.basename(filePath));
  }

  async readText(path: string): Promise<string | null> {
    try {
      return await this.sandbox.readFile(path);
    } catch (error) {
      if (error instanceof SandboxFileError) return null;
      throw error;
    }
  }

  async readJson<T = unknown>(path: string): Promise<JsonRead<T>> {
    const text = await this.readText(path);
    if (text === null) return { status: "missing" };
    try {
      return { status: "ok", value: JSON.parse(text) as T };
    } catch (error) {
      return {
        status: "invalid",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
