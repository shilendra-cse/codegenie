import { describe, expect, it } from "vitest";
import { ToolError } from "./tool-error.js";
import {
  displayPath,
  LOG_DIR,
  resolveWorkspacePath,
} from "./workspace-path.js";

describe("resolveWorkspacePath", () => {
  it("resolves relative and absolute paths inside /workspace", () => {
    expect(resolveWorkspacePath("src/app.ts", "read")).toBe(
      "/workspace/src/app.ts",
    );
    expect(resolveWorkspacePath("./src/../src/app.ts", "write")).toBe(
      "/workspace/src/app.ts",
    );
    expect(resolveWorkspacePath("/workspace/a.ts", "read")).toBe(
      "/workspace/a.ts",
    );
    expect(resolveWorkspacePath(".", "read")).toBe("/workspace");
  });

  it("rejects paths outside /workspace", () => {
    for (const p of [
      "..",
      "../etc/passwd",
      "/etc/passwd",
      "/workspace-other/x",
    ]) {
      expect(() => resolveWorkspacePath(p, "read")).toThrow(ToolError);
    }
  });

  it("rejects empty paths", () => {
    expect(() => resolveWorkspacePath("  ", "read")).toThrow(/empty/);
  });

  it("refuses writes inside any .git directory but allows reads", () => {
    expect(() => resolveWorkspacePath(".git/config", "write")).toThrow(/\.git/);
    expect(() => resolveWorkspacePath("packages/x/.git/HEAD", "write")).toThrow(
      /\.git/,
    );
    expect(resolveWorkspacePath(".git/config", "read")).toBe(
      "/workspace/.git/config",
    );
    // A file merely named like .gitignore is fine.
    expect(resolveWorkspacePath(".gitignore", "write")).toBe(
      "/workspace/.gitignore",
    );
  });

  it("allows reading saved logs but not writing them", () => {
    const log = `${LOG_DIR}/0001-bash.log`;
    expect(resolveWorkspacePath(log, "read")).toBe(log);
    expect(() => resolveWorkspacePath(log, "write")).toThrow(ToolError);
  });
});

describe("displayPath", () => {
  it("shows workspace paths relative and others absolute", () => {
    expect(displayPath("/workspace")).toBe(".");
    expect(displayPath("/workspace/src/a.ts")).toBe("src/a.ts");
    expect(displayPath(`${LOG_DIR}/x.log`)).toBe(`${LOG_DIR}/x.log`);
  });
});
