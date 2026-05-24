import fs from "node:fs/promises";
import { config } from "@/config";
import path from "node:path";

function workspacesRootResolved(): string {
  return path.resolve(config.workspaces.root);
}

function assertUnderWorkspacesRoot(resolved: string): void {
  const root = workspacesRootResolved();
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;

  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error(
      `Path ${resolved} is not under the workspaces root: ${root}`,
    );
  }
}

export function projectWorkspaceRelative(
  userId: string,
  projectId: string,
): string {
  return path.posix.join(userId, projectId);
}

export function projectWorkspaceAbsolute(
  userId: string,
  projectId: string,
): string {
  const abs = path.join(
    workspacesRootResolved(),
    projectWorkspaceRelative(userId, projectId),
  );
  const resolved = path.resolve(abs);
  assertUnderWorkspacesRoot(resolved);
  return resolved;
}

export async function ensureProjectWorkspace(
  userId: string,
  projectId: string,
): Promise<string> {
  const dir = projectWorkspaceAbsolute(userId, projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

//when we get a path from the database, we need to resolve it to the absolute path from the database
export function resolveStoredWorkspacePath(stored: string): string {
  const resolved = path.resolve(workspacesRootResolved(), stored);
  assertUnderWorkspacesRoot(resolved);
  return resolved;
}
