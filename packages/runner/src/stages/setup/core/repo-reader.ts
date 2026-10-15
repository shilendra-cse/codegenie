import {
  SandboxFileError,
  WORKSPACE_DIR,
  type Sandbox,
} from "@codegenie/sandbox";

export type JsonRead<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "invalid"; error: string };

/**
 * Read-only view of the repository for detectors. Paths are relative to the
 * workspace root. Detectors use this instead of running commands, which keeps
 * them simple and testable.
 */
export class RepoReader {
  private rootNames: Promise<Set<string>> | null = null;

  constructor(private readonly sandbox: Sandbox) {}

  /** Whether a file or folder exists directly in the repository root. */
  async hasRootEntry(name: string) {
    this.rootNames ??= this.sandbox
      .listFiles(WORKSPACE_DIR, { maxDepth: 1 })
      .then(
        (entries) =>
          new Set(entries.map((e) => e.path.slice(WORKSPACE_DIR.length + 1))),
      );
    return (await this.rootNames).has(name);
  }

  /** File content, or null if the file doesn't exist or can't be read. */
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
