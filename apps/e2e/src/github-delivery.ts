import { createHash } from "node:crypto";
import { githubDeliveryApi } from "@hobai/worker/testing";

type TreeEntry = { path: string; mode: string; sha: string | null };

/**
 * Git's hash of a tree holding only these files. Hello-World is a single README, so a commit that
 * rewrites it has exactly the files written as its tree, and the fake can answer as GitHub would.
 */
function flatTreeSha(entries: TreeEntry[]) {
  const files = entries.filter((entry) => entry.sha !== null);
  if (files.some((file) => file.path.includes("/"))) {
    throw new Error("The e2e GitHub only builds trees without folders.");
  }
  const body = Buffer.concat(
    files
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .flatMap((file) => [
        Buffer.from(`${file.mode} ${file.path}\0`),
        Buffer.from(file.sha!, "hex"),
      ]),
  );
  return createHash("sha1")
    .update(`tree ${body.length}\0`)
    .update(body)
    .digest("hex");
}

/** Answers a delivery like GitHub, building the real tree the worker checks against. */
export function e2eDeliveryApi(): ReturnType<typeof githubDeliveryApi> {
  const delivery = githubDeliveryApi();
  return (call) => {
    if (call.method === "POST" && call.path.endsWith("/git/trees")) {
      const { tree } = call.body as { tree: TreeEntry[] };
      return { status: 201, body: { sha: flatTreeSha(tree) } };
    }
    return delivery(call);
  };
}
