import { describe, expect, it } from "vitest";
import {
  commitToBranch,
  CommitMismatchError,
  type NewCommit,
} from "./commit-to-branch.js";
import { fakeGithubClient, type FakeCall } from "./testing/index.js";

const sha = (c: string) => c.repeat(40);

const commit: NewCommit = {
  owner: "acme",
  repo: "app",
  branch: "hobai/1234abcd-add-health",
  message: "Add GET /health\n\nAdded the route and a test.",
  parent: sha("p"),
  tree: sha("t"),
  writes: [
    {
      path: "src/health.ts",
      mode: "100644",
      sha: sha("1"),
      read: async () => Buffer.from("export const ok = true;\n"),
    },
    {
      path: "scripts/check.sh",
      mode: "100755",
      sha: sha("2"),
      read: async () => Buffer.from([0, 255, 10]),
    },
  ],
  deletions: ["src/old.ts"],
};

function github(overrides: { blob?: string; tree?: string } = {}) {
  let blobs = 0;
  return fakeGithubClient((call: FakeCall) => {
    if (call.path.endsWith("/git/blobs")) {
      blobs += 1;
      return {
        status: 201,
        body: { sha: overrides.blob ?? sha(String(blobs)) },
      };
    }
    if (call.path.endsWith(`/git/commits/${sha("p")}`))
      return { status: 200, body: { sha: sha("p"), tree: { sha: sha("b") } } };
    if (call.path.endsWith("/git/trees"))
      return { status: 201, body: { sha: overrides.tree ?? sha("t") } };
    if (call.path.endsWith("/git/commits"))
      return { status: 201, body: { sha: sha("c") } };
    if (call.path.endsWith("/git/refs"))
      return { status: 201, body: { ref: `refs/heads/${commit.branch}` } };
    return { status: 404, body: { message: "Not Found" } };
  });
}

describe("commitToBranch", () => {
  it("uploads each file, builds the tree on the parent's, commits and creates the branch", async () => {
    const { client, calls } = github();

    expect(await commitToBranch(client, commit)).toEqual({ sha: sha("c") });

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /repos/acme/app/git/blobs",
      "POST /repos/acme/app/git/blobs",
      `GET /repos/acme/app/git/commits/${sha("p")}`,
      "POST /repos/acme/app/git/trees",
      "POST /repos/acme/app/git/commits",
      "POST /repos/acme/app/git/refs",
    ]);
    expect(calls[1]!.body).toEqual({ content: "AP8K", encoding: "base64" });
    expect(calls[3]!.body).toEqual({
      base_tree: sha("b"),
      tree: [
        { path: "src/health.ts", mode: "100644", type: "blob", sha: sha("1") },
        {
          path: "scripts/check.sh",
          mode: "100755",
          type: "blob",
          sha: sha("2"),
        },
        { path: "src/old.ts", mode: "100644", type: "blob", sha: null },
      ],
    });
    expect(calls[4]!.body).toEqual({
      message: commit.message,
      tree: sha("t"),
      parents: [sha("p")],
    });
    expect(calls[5]!.body).toEqual({
      ref: "refs/heads/hobai/1234abcd-add-health",
      sha: sha("c"),
    });
  });

  it("stops when GitHub stored different content for a file", async () => {
    const { client, calls } = github({ blob: sha("x") });

    const failure = commitToBranch(client, commit);

    await expect(failure).rejects.toBeInstanceOf(CommitMismatchError);
    await expect(failure).rejects.toThrow("src/health.ts");
    expect(calls).toHaveLength(1);
  });

  it("stops before committing when the tree isn't the expected one", async () => {
    const { client, calls } = github({ tree: sha("x") });

    await expect(commitToBranch(client, commit)).rejects.toThrow(
      `GitHub built a different tree (${sha("x")}, expected ${sha("t")}).`,
    );
    expect(calls.map((c) => c.path).at(-1)).toBe("/repos/acme/app/git/trees");
  });
});
