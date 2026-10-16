import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ALWAYS_SKIPPED = new Set([".git", "node_modules"]);

async function gitListedFiles(dir: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        dir,
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(dir, prefix), {
    withFileTypes: true,
  })) {
    if (ALWAYS_SKIPPED.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(dir, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/**
 * Files to copy from a local folder: in a git repository, tracked files plus untracked
 * files that aren't ignored (so node_modules, build output and .env stay out);
 * otherwise everything except .git and node_modules.
 */
export async function listLocalFiles(dir: string): Promise<string[]> {
  const listed = await gitListedFiles(dir);
  if (!listed) return walk(dir);

  const existing: string[] = [];
  for (const file of listed) {
    if (file.split("/").some((part) => ALWAYS_SKIPPED.has(part))) continue;
    // ls-files still lists tracked files that were deleted from the working tree.
    if (await isFile(path.join(dir, file))) existing.push(file);
  }
  return existing;
}
