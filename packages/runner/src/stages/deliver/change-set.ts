import { createHash } from "node:crypto";
import type { Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "../../lib/shell-quote.js";

export type FileMode = "100644" | "100755" | "120000";

export type FileWrite = {
  path: string;
  mode: FileMode;
  /** Git's blob hash of the content; GitHub computes the same one. */
  sha: string;
  size: number;
};

export type ChangeSet = {
  /** The checked-out commit, under the baseline commit: the delivered commit's parent. */
  parent: string;
  /** The parent's tree plus these changes: what the delivered commit's tree must be. */
  tree: string;
  writes: FileWrite[];
  deletions: string[];
  readFile: (file: FileWrite) => Promise<Buffer>;
};

export class DeliverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliverError";
  }
}

export const MAX_FILES = 1000;
export const MAX_BYTES = 50 * 1024 * 1024;
// Base64 of a chunk stays under the sandbox's 1 MB output limit.
const CHUNK_BYTES = 700 * 1024;
const TEMP_INDEX = "/tmp/codegenie/deliver.index";
const ENTRIES_PER_COMMAND = 200;
const FILE_MODES = new Set<string>(["100644", "100755", "120000"]);

async function git(sandbox: Sandbox, command: string, what: string) {
  const result = await sandbox.exec(command);
  if (result.exitCode !== 0 || result.truncated) {
    throw new DeliverError(
      `Could not ${what}: ${result.stderr.trim() || (result.truncated ? "output too large" : `exit code ${result.exitCode}`)}`,
    );
  }
  return result.stdout;
}

/** Freezes the staged changes, so files written by later check runs stay out of the delivery. */
export async function snapshotChanges(sandbox: Sandbox): Promise<string> {
  return (await git(sandbox, "git write-tree", "snapshot the changes")).trim();
}

export function parseRawDiff(raw: string) {
  const fields = raw.split("\0");
  const writes: Omit<FileWrite, "size">[] = [];
  const deletions: string[] = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [oldMode, newMode, , sha, status] = fields[i]!.slice(1).split(" ");
    const path = fields[i + 1]!;
    if (path.includes("\uFFFD")) {
      throw new DeliverError(
        `${JSON.stringify(path)} isn't a UTF-8 file name.`,
      );
    }
    if (status === "D") {
      if (oldMode === "160000") throw unsupported(path);
      deletions.push(path);
      continue;
    }
    if (!FILE_MODES.has(newMode!) || oldMode === "160000")
      throw unsupported(path);
    writes.push({ path, mode: newMode as FileMode, sha: sha! });
  }
  return { writes, deletions };
}

function unsupported(path: string) {
  return new DeliverError(
    `${path} is a submodule; changes to submodules can't be delivered.`,
  );
}

export function blobSha(content: Buffer) {
  return createHash("sha1")
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest("hex");
}

async function sizes(sandbox: Sandbox, shas: string[]) {
  const result = new Map<string, number>();
  if (shas.length === 0) return result;
  const output = await git(
    sandbox,
    `printf '%s\\n' ${shas.join(" ")} | git cat-file --batch-check='%(objectname) %(objectsize)'`,
    "read the changed files' sizes",
  );
  for (const line of output.trim().split("\n")) {
    const [sha, size] = line.split(" ");
    result.set(sha!, Number(size));
  }
  return result;
}

async function expectedTree(
  sandbox: Sandbox,
  parent: string,
  writes: FileWrite[],
  deletions: string[],
) {
  const index = `GIT_INDEX_FILE=${TEMP_INDEX}`;
  const commands = [
    `mkdir -p /tmp/codegenie && rm -f ${TEMP_INDEX} && ${index} git read-tree ${parent}`,
  ];
  for (let i = 0; i < writes.length; i += ENTRIES_PER_COMMAND) {
    const entries = writes
      .slice(i, i + ENTRIES_PER_COMMAND)
      .map((f) => `--cacheinfo ${shellQuote(`${f.mode},${f.sha},${f.path}`)}`);
    commands.push(`${index} git update-index --add ${entries.join(" ")}`);
  }
  for (let i = 0; i < deletions.length; i += ENTRIES_PER_COMMAND) {
    const paths = deletions.slice(i, i + ENTRIES_PER_COMMAND).map(shellQuote);
    commands.push(
      `${index} git update-index --force-remove -- ${paths.join(" ")}`,
    );
  }
  for (const command of commands) {
    await git(sandbox, command, "build the delivered tree");
  }
  const tree = await git(
    sandbox,
    `${index} git write-tree`,
    "build the delivered tree",
  );
  await sandbox.exec(`rm -f ${TEMP_INDEX}`);
  return tree.trim();
}

async function readBlob(sandbox: Sandbox, file: FileWrite) {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const encoded = await git(
      sandbox,
      `git cat-file blob ${file.sha} | tail -c +${offset + 1} | head -c ${CHUNK_BYTES} | base64 -w0`,
      `read ${file.path}`,
    );
    chunks.push(Buffer.from(encoded, "base64"));
  }
  const content = Buffer.concat(chunks);
  if (blobSha(content) !== file.sha) {
    throw new DeliverError(
      `${file.path} changed or was misread while delivering.`,
    );
  }
  return content;
}

/** The agent's changes since the baseline, ready to become one commit on the checked-out commit. */
export async function listChanges(
  sandbox: Sandbox,
  baseline: string,
  snapshot: string,
): Promise<ChangeSet> {
  const parent = await sandbox.exec(
    `git rev-parse --verify --quiet ${shellQuote(`${baseline}^`)}`,
  );
  if (parent.exitCode !== 0) {
    throw new DeliverError(
      "The checkout has no commit to deliver the changes on.",
    );
  }
  const raw = await git(
    sandbox,
    `git diff-tree -r -z --raw --no-abbrev --no-renames ${shellQuote(baseline)} ${shellQuote(snapshot)}`,
    "list the changes",
  );
  const changes = parseRawDiff(raw);
  const count = changes.writes.length + changes.deletions.length;
  if (count > MAX_FILES) {
    throw new DeliverError(
      `${count} files changed; at most ${MAX_FILES} can be delivered.`,
    );
  }

  const sizeOf = await sizes(sandbox, [
    ...new Set(changes.writes.map((f) => f.sha)),
  ]);
  const writes = changes.writes.map((f) => ({
    ...f,
    size: sizeOf.get(f.sha) ?? 0,
  }));
  const bytes = writes.reduce((sum, f) => sum + f.size, 0);
  if (bytes > MAX_BYTES) {
    throw new DeliverError(
      `The changed files total ${bytes} bytes; at most ${MAX_BYTES} can be delivered.`,
    );
  }

  const parentSha = parent.stdout.trim();
  return {
    parent: parentSha,
    tree: await expectedTree(sandbox, parentSha, writes, changes.deletions),
    writes,
    deletions: changes.deletions,
    readFile: (file) => readBlob(sandbox, file),
  };
}
