import type { Octokit } from "@octokit/rest";

export type CommitFile = {
  path: string;
  mode: "100644" | "100755" | "120000";
  /** Git's blob hash of the content, which GitHub must compute too. */
  sha: string;
  read: () => Promise<Buffer>;
};

export type NewCommit = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  parent: string;
  /** The tree hash the commit must end up with. */
  tree: string;
  writes: CommitFile[];
  deletions: string[];
};

export class CommitMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommitMismatchError";
  }
}

/**
 * Creates one commit on a new branch through the API. The App is its author,
 * so GitHub signs it and shows it as verified.
 */
export async function commitToBranch(
  client: Octokit,
  commit: NewCommit,
): Promise<{ sha: string }> {
  const repo = { owner: commit.owner, repo: commit.repo };

  // One file at a time, so a large change is never held in memory at once.
  for (const file of commit.writes) {
    const content = await file.read();
    const { data: blob } = await client.rest.git.createBlob({
      ...repo,
      content: content.toString("base64"),
      encoding: "base64",
    });
    if (blob.sha !== file.sha) {
      throw new CommitMismatchError(
        `GitHub stored different content for ${file.path} (${blob.sha}, expected ${file.sha}).`,
      );
    }
  }

  const { data: parent } = await client.rest.git.getCommit({
    ...repo,
    commit_sha: commit.parent,
  });
  const { data: tree } = await client.rest.git.createTree({
    ...repo,
    base_tree: parent.tree.sha,
    tree: [
      ...commit.writes.map((file) => ({
        path: file.path,
        mode: file.mode,
        type: "blob" as const,
        sha: file.sha,
      })),
      ...commit.deletions.map((path) => ({
        path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null,
      })),
    ],
  });
  if (tree.sha !== commit.tree) {
    throw new CommitMismatchError(
      `GitHub built a different tree (${tree.sha}, expected ${commit.tree}).`,
    );
  }

  const { data: created } = await client.rest.git.createCommit({
    ...repo,
    message: commit.message,
    tree: tree.sha,
    parents: [commit.parent],
  });
  await client.rest.git.createRef({
    ...repo,
    ref: `refs/heads/${commit.branch}`,
    sha: created.sha,
  });
  return { sha: created.sha };
}
