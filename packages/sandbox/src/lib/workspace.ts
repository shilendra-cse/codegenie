import path from "node:path";
import { WORKSPACE_DIR } from "../core/types.js";

export function resolveInWorkspace(p: string) {
  return path.posix.resolve(WORKSPACE_DIR, p);
}
