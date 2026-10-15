import path from "node:path";
import { WORKSPACE_DIR } from "@codegenie/sandbox";
import { ToolError } from "./tool-error.js";

/** Full command output is saved here, outside /workspace so it never ends up in the diff. */
export const LOG_DIR = "/tmp/codegenie/logs";

export type PathAccess = "read" | "write";

function isWithin(abs: string, dir: string) {
  return abs === dir || abs.startsWith(`${dir}/`);
}

/**
 * Resolves a path the model gave us to an absolute path inside the sandbox.
 * - Relative paths resolve against /workspace; everything must stay inside it.
 * - Reads may also target LOG_DIR (saved command output).
 * - Writes inside any .git directory are refused: git is handled outside the agent.
 *
 * The container is the real security boundary; these checks keep the agent on task
 * and protect the repository's history.
 */
export function resolveWorkspacePath(input: string, access: PathAccess) {
  if (!input.trim()) {
    throw new ToolError("Path is empty.");
  }
  const abs = path.posix.resolve(WORKSPACE_DIR, input);

  if (access === "read" && isWithin(abs, LOG_DIR)) {
    return abs;
  }
  if (!isWithin(abs, WORKSPACE_DIR)) {
    throw new ToolError(
      `${input} is outside the workspace. Only paths inside ${WORKSPACE_DIR} can be used.`,
    );
  }
  if (access === "write" && abs.split("/").includes(".git")) {
    throw new ToolError(
      "Writing inside .git is not allowed. Git operations are handled outside the agent.",
    );
  }
  return abs;
}

/** Path to show the model: relative to /workspace when inside it, otherwise absolute. */
export function displayPath(abs: string) {
  if (abs === WORKSPACE_DIR) return ".";
  if (isWithin(abs, WORKSPACE_DIR)) return abs.slice(WORKSPACE_DIR.length + 1);
  return abs;
}
