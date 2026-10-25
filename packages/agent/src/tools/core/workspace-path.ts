import path from "node:path";
import { SANDBOX_LOG_DIR, WORKSPACE_DIR } from "@hobai/sandbox";
import { ToolError } from "./tool-error.js";

export const LOG_DIR = SANDBOX_LOG_DIR;

export type PathAccess = "read" | "write";

function isWithin(abs: string, dir: string) {
  return abs === dir || abs.startsWith(`${dir}/`);
}

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

export function displayPath(abs: string) {
  if (abs === WORKSPACE_DIR) return ".";
  if (isWithin(abs, WORKSPACE_DIR)) return abs.slice(WORKSPACE_DIR.length + 1);
  return abs;
}
