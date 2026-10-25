import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SHORT_NAME } from "@hobai/shared/brand";
import { REPOS_DIR } from "../paths.js";
import { loadRepo, type EvalRepo } from "./repos.js";

const grader = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hidden-tests"),
      /** Folder in the repository the hidden files are copied into. */
      target: z.string().min(1).default(`${SHORT_NAME}-hidden`),
      command: z.string().min(1),
      cwd: z.string().min(1).default("."),
    })
    .strict(),
  z
    .object({
      type: z.literal("checks"),
      /** Checks (name@cwd) that must pass after the agent's changes. */
      passing: z.array(z.string().regex(/^[a-z]+@.+$/)).min(1),
    })
    .strict(),
  z.object({ type: z.literal("manual") }).strict(),
]);

const taskFile = z
  .object({
    task: z.string().min(1),
    /** A patch in the task folder, applied after checkout (e.g. to plant a bug). */
    patch: z.string().optional(),
    grader,
    limits: z
      .object({
        maxSteps: z.number().int().positive(),
        maxCostUsd: z.number().positive(),
        maxMinutes: z.number().positive(),
      })
      .partial()
      .optional(),
  })
  .strict();

export type TaskGrader = z.infer<typeof grader>;
export type EvalTask = z.infer<typeof taskFile> & {
  /** "<repo>/<task>", e.g. "ts-lib/paginate-bug". */
  id: string;
  repo: EvalRepo;
  dir: string;
  /** Paths relative to the task's hidden/ folder. */
  hiddenFiles: string[];
};

async function subfolders(dir: string) {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path.join(dir, prefix), { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(dir, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

async function loadTask(repo: EvalRepo, name: string): Promise<EvalTask> {
  const id = `${repo.name}/${name}`;
  const dir = path.join(repo.dir, "tasks", name);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(dir, "task.json"), "utf8"));
  } catch (error) {
    throw new Error(
      `Task ${id}: can't read task.json (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  const parsed = taskFile.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Task ${id}: ${issues}`);
  }
  const hiddenFiles = await listFiles(path.join(dir, "hidden"));
  if (parsed.data.grader.type === "hidden-tests" && hiddenFiles.length === 0) {
    throw new Error(
      `Task ${id}: the hidden-tests grader needs files in hidden/`,
    );
  }
  return { ...parsed.data, id, repo, dir, hiddenFiles };
}

export type TaskFilter = {
  /** Task ids ("<repo>/<task>"); empty for all. */
  tasks?: string[];
  /** Repository names; empty for all. */
  repos?: string[];
};

export async function loadTasks(
  filter: TaskFilter = {},
  reposDir = REPOS_DIR,
): Promise<EvalTask[]> {
  const repoNames = await subfolders(reposDir);
  const unknownRepos = (filter.repos ?? []).filter(
    (r) => !repoNames.includes(r),
  );
  if (unknownRepos.length)
    throw new Error(`Unknown repository: ${unknownRepos.join(", ")}`);

  const all: EvalTask[] = [];
  for (const name of repoNames) {
    if (filter.repos?.length && !filter.repos.includes(name)) continue;
    const repo = await loadRepo(path.join(reposDir, name));
    for (const taskName of await subfolders(path.join(repo.dir, "tasks"))) {
      all.push(await loadTask(repo, taskName));
    }
  }

  const wanted = filter.tasks ?? [];
  const unknown = wanted.filter((id) => !all.some((t) => t.id === id));
  if (unknown.length) throw new Error(`Unknown task: ${unknown.join(", ")}`);
  return wanted.length ? all.filter((t) => wanted.includes(t.id)) : all;
}
