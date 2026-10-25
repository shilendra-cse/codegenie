import { createHash } from "node:crypto";
import type { GithubApp, RepoPermissions } from "@hobai/github";
import {
  fakeGithubClient,
  type FakeCall,
  type FakeReply,
} from "@hobai/github/testing";

export const FAKE_REPO_TOKEN = "ghs_faketoken0123456789abcdefghijklmnop";
export const FAKE_TREE_SHA = "7".repeat(40);
export const FAKE_COMMIT_SHA = "c".repeat(40);
export const FAKE_PR_NUMBER = 7;

const blobSha = (content: Buffer) =>
  createHash("sha1")
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest("hex");

/** Answers like GitHub for a delivery: blob hashes computed from the content, fixed tree and commit hashes. */
export function githubDeliveryApi(
  options: { draftUnavailable?: boolean } = {},
) {
  return (call: FakeCall): FakeReply => {
    const body = call.body as Record<string, unknown> | undefined;
    if (call.path.endsWith("/git/blobs")) {
      const content = Buffer.from(String(body!.content), "base64");
      return { status: 201, body: { sha: blobSha(content) } };
    }
    if (call.method === "GET" && call.path.includes("/git/commits/")) {
      return { status: 200, body: { tree: { sha: "b".repeat(40) } } };
    }
    if (call.path.endsWith("/git/trees")) {
      return { status: 201, body: { sha: FAKE_TREE_SHA } };
    }
    if (call.path.endsWith("/git/commits")) {
      return { status: 201, body: { sha: FAKE_COMMIT_SHA } };
    }
    if (call.path.endsWith("/git/refs")) {
      return { status: 201, body: { ref: body!.ref } };
    }
    if (call.path.endsWith("/pulls")) {
      if (body!.draft && options.draftUnavailable) {
        return {
          status: 422,
          body: {
            message: "Validation Failed",
            errors: [
              {
                resource: "PullRequest",
                code: "custom",
                message:
                  "Draft pull requests are not supported in this repository.",
              },
            ],
          },
        };
      }
      const repo = call.path.replace(/^\/repos\//, "").replace(/\/pulls$/, "");
      return {
        status: 201,
        body: {
          number: FAKE_PR_NUMBER,
          html_url: `https://github.com/${repo}/pull/${FAKE_PR_NUMBER}`,
          draft: Boolean(body!.draft),
        },
      };
    }
    return { status: 404, body: { message: "Not Found" } };
  };
}

export function fakeGithubApp(
  token = FAKE_REPO_TOKEN,
  api: (call: FakeCall, index: number) => FakeReply = githubDeliveryApi(),
) {
  const requests: {
    installationId: number;
    repoId: number;
    permissions: RepoPermissions;
  }[] = [];
  const { client, calls } = fakeGithubClient(api);
  const github: Pick<GithubApp, "repoToken" | "repoClient"> = {
    repoToken(installationId, repoId, permissions) {
      requests.push({ installationId, repoId, permissions });
      return Promise.resolve({
        token,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
    },
    repoClient(installationId, repoId, permissions) {
      requests.push({ installationId, repoId, permissions });
      return Promise.resolve(client);
    },
  };
  return { github, requests, calls };
}
