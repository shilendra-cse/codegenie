import { describe, expect, it } from "vitest";
import {
  listInstallationRepos,
  listUserInstallations,
} from "./user-installations.js";

function fakeGithub(key: string, pages: unknown[][]) {
  const requests: {
    path: string;
    page: string | null;
    authorization: string;
  }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      path: url.pathname,
      page: url.searchParams.get("page"),
      authorization: new Headers(init?.headers).get("authorization") ?? "",
    });
    const page = Number(url.searchParams.get("page") ?? "1");
    const next =
      page < pages.length
        ? {
            link: `<${url.origin}${url.pathname}?per_page=100&page=${page + 1}>; rel="next"`,
          }
        : {};
    const response = new Response(
      JSON.stringify({
        total_count: pages.flat().length,
        [key]: pages[page - 1],
      }),
      { status: 200, headers: { "content-type": "application/json", ...next } },
    );
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  };
  return { fetch, requests };
}

const installation = (id: number, login: string, type: string) => ({
  id,
  account: { login, type },
});

describe("listUserInstallations", () => {
  it("lists the installations the user can access, across pages", async () => {
    const github = fakeGithub("installations", [
      [installation(1, "ada", "User")],
      [installation(2, "acme", "Organization")],
    ]);

    expect(await listUserInstallations("ghu_user", github)).toEqual([
      { id: 1, accountLogin: "ada", accountType: "user" },
      { id: 2, accountLogin: "acme", accountType: "organization" },
    ]);
    expect(github.requests).toMatchObject([
      { path: "/user/installations", authorization: "token ghu_user" },
      { path: "/user/installations", page: "2" },
    ]);
  });

  it("skips installations without a named account", async () => {
    const github = fakeGithub("installations", [[{ id: 3, account: null }]]);
    expect(await listUserInstallations("ghu_user", github)).toEqual([]);
  });
});

const repo = (id: number, name: string) => ({
  id,
  name,
  full_name: `acme/${name}`,
  owner: { login: "acme" },
  default_branch: "main",
  private: id % 2 === 0,
  html_url: `https://github.com/acme/${name}`,
  updated_at: "2026-10-20T10:00:00Z",
  language: id === 1 ? "TypeScript" : null,
});

describe("listInstallationRepos", () => {
  it("lists the repositories of one installation the user can access", async () => {
    const github = fakeGithub("repositories", [
      [repo(1, "api")],
      [repo(2, "web")],
    ]);

    expect(await listInstallationRepos("ghu_user", 42, github)).toEqual([
      {
        id: 1,
        fullName: "acme/api",
        owner: "acme",
        name: "api",
        defaultBranch: "main",
        private: false,
        htmlUrl: "https://github.com/acme/api",
        updatedAt: "2026-10-20T10:00:00Z",
        language: "TypeScript",
      },
      expect.objectContaining({
        id: 2,
        fullName: "acme/web",
        private: true,
        language: null,
      }),
    ]);
    expect(github.requests[0]).toMatchObject({
      path: "/user/installations/42/repositories",
      authorization: "token ghu_user",
    });
  });

  it("returns null for an installation the user can't access", async () => {
    const fetch: typeof globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      );
    expect(await listInstallationRepos("ghu_user", 99, { fetch })).toBeNull();
  });
});
