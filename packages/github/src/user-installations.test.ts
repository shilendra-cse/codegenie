import { describe, expect, it } from "vitest";
import { listUserInstallations } from "./user-installations.js";

function fakeGithub(pages: unknown[][]) {
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
        installations: pages[page - 1],
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
    const github = fakeGithub([
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
    const github = fakeGithub([[{ id: 3, account: null }]]);
    expect(await listUserInstallations("ghu_user", github)).toEqual([]);
  });
});
