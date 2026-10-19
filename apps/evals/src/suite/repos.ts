import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RepoSource } from "@codegenie/runner";
import type { Sandbox } from "@codegenie/sandbox";
import { z } from "zod";

const repoFile = z.union([
  z.object({ fixture: z.literal(true) }).strict(),
  z
    .object({
      git: z.string().url(),
      commit: z.string().regex(/^[0-9a-f]{7,40}$/, "a commit SHA"),
    })
    .strict(),
]);

/** A repository the eval tasks run on: a fixture in source/, or a git repository at a pinned commit. */
export type EvalRepo = z.infer<typeof repoFile> & { name: string; dir: string };

export async function loadRepo(dir: string): Promise<EvalRepo> {
  const name = path.basename(dir);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(dir, "repo.json"), "utf8"));
  } catch (error) {
    throw new Error(
      `Repository ${name}: can't read repo.json (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  const parsed = repoFile.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Repository ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`,
    );
  }
  return { ...parsed.data, name, dir };
}

export function repoSource(repo: EvalRepo): RepoSource {
  return "fixture" in repo
    ? { type: "local", path: path.join(repo.dir, "source") }
    : { type: "git", url: repo.git };
}

/** Moves a shallow clone to the pinned commit; fixtures need nothing. */
export async function pinCommit(sandbox: Sandbox, repo: EvalRepo) {
  if ("fixture" in repo) return;
  const result = await sandbox.exec(
    `git fetch --quiet --depth 1 origin ${repo.commit} && git checkout --quiet ${repo.commit}`,
    { timeoutMs: 5 * 60_000 },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `Could not check out commit ${repo.commit}: ${result.stderr.trim() || `exit code ${result.exitCode}`}`,
    );
  }
}
