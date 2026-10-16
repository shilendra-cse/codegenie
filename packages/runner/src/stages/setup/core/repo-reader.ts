import {
  SandboxFileError,
  WORKSPACE_DIR,
  type Sandbox,
} from "@codegenie/sandbox";

export type JsonRead<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "invalid"; error: string };

export class RepoReader {
  private rootNames: Promise<Set<string>> | null = null;

  constructor(private readonly sandbox: Sandbox) {}

  async hasRootEntry(name: string) {
    this.rootNames ??= this.sandbox
      .listFiles(WORKSPACE_DIR, { maxDepth: 1 })
      .then(
        (entries) =>
          new Set(entries.map((e) => e.path.slice(WORKSPACE_DIR.length + 1))),
      );
    return (await this.rootNames).has(name);
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
