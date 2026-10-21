import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGithubApp } from "./github-app.js";
import { GithubConfigError } from "./private-key.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

type Call = {
  method: string;
  path: string;
  authorization: string;
  body: unknown;
};
type Reply = { status: number; body: unknown };

function fakeGithub(answer: (call: Call, index: number) => Reply) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const call = {
      method: init?.method ?? "GET",
      path: url.pathname,
      authorization: headers.get("authorization") ?? "",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const { status, body } = answer(call, calls.length - 1);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

const tokenReply = (token: string, minutesLeft: number): Reply => ({
  status: 201,
  body: {
    token,
    expires_at: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
    permissions: { contents: "read" },
    repository_selection: "selected",
  },
});

function verifiedJwtPayload(authorization: string) {
  const [header, payload, signature] = authorization
    .replace(/^bearer /i, "")
    .split(".");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${header}.${payload}`);
  expect(verifier.verify(publicKey, signature!, "base64url")).toBe(true);
  return JSON.parse(Buffer.from(payload!, "base64url").toString());
}

describe("createGithubApp", () => {
  it("mints a token for one repository with only the given permissions", async () => {
    const github = fakeGithub(() => tokenReply("ghs_one", 60));
    const app = createGithubApp({ appId: 123, privateKey }, github);

    const minted = await app.repoToken(42, 9001, { contents: "read" });

    expect(minted.token).toBe("ghs_one");
    expect(minted.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(github.calls).toMatchObject([
      {
        method: "POST",
        path: "/app/installations/42/access_tokens",
        body: { repository_ids: [9001], permissions: { contents: "read" } },
      },
    ]);
    expect(verifiedJwtPayload(github.calls[0]!.authorization)).toMatchObject({
      iss: 123,
    });
  });

  it("reuses a token, but not across repositories or permissions", async () => {
    const github = fakeGithub((_, i) => tokenReply(`ghs_${i}`, 60));
    const app = createGithubApp({ appId: 123, privateKey }, github);

    const first = await app.repoToken(42, 9001, { contents: "read" });
    const again = await app.repoToken(42, 9001, { contents: "read" });
    const write = await app.repoToken(42, 9001, { contents: "write" });
    const other = await app.repoToken(42, 9002, { contents: "read" });

    expect(again.token).toBe(first.token);
    expect(new Set([first.token, write.token, other.token]).size).toBe(3);
    expect(github.calls).toHaveLength(3);
  });

  it("mints a fresh token when the cached one is about to expire", async () => {
    const github = fakeGithub((_, i) =>
      i === 0 ? tokenReply("ghs_old", 2) : tokenReply("ghs_new", 60),
    );
    const app = createGithubApp({ appId: 123, privateKey }, github);

    const minted = await app.repoToken(42, 9001, { contents: "read" });

    expect(minted.token).toBe("ghs_new");
    expect(github.calls).toHaveLength(2);
  });

  it("gives an API client authenticated with the repository's token", async () => {
    const github = fakeGithub((call) =>
      call.path.endsWith("/access_tokens")
        ? tokenReply("ghs_client", 60)
        : { status: 200, body: { full_name: "acme/app" } },
    );
    const app = createGithubApp({ appId: 123, privateKey }, github);

    const client = await app.repoClient(42, 9001, { pull_requests: "write" });
    const { data } = await client.rest.repos.get({
      owner: "acme",
      repo: "app",
    });

    expect(data.full_name).toBe("acme/app");
    expect(github.calls[1]).toMatchObject({
      path: "/repos/acme/app",
      authorization: "token ghs_client",
    });
  });

  it("finds the installation covering a repository, or null", async () => {
    const github = fakeGithub((call) =>
      call.path === "/repos/acme/app/installation"
        ? { status: 200, body: { id: 77 } }
        : { status: 404, body: { message: "Not Found" } },
    );
    const app = createGithubApp({ appId: 123, privateKey }, github);

    expect(await app.installationForRepo("acme", "app")).toBe(77);
    expect(await app.installationForRepo("acme", "other")).toBeNull();
    expect(verifiedJwtPayload(github.calls[0]!.authorization)).toMatchObject({
      iss: 123,
    });
  });

  it("rejects a private key that isn't PEM", () => {
    expect(() =>
      createGithubApp({ appId: 123, privateKey: "not a key" }),
    ).toThrow(GithubConfigError);
  });
});
