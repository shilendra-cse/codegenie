import { describe, expect, it } from "vitest";
import {
  listInstallationRepos,
  listRepoBranches,
  listUserInstallations,
} from "../user-installations.js";
import { E2E_GITHUB, e2eGithubFetch } from "./e2e-github.js";

function fake({ installed = true } = {}) {
  const passedOn: string[] = [];
  const calls: string[] = [];
  const fetch = e2eGithubFetch(
    (input) => {
      passedOn.push(String(input));
      return Promise.resolve(new Response("real"));
    },
    {
      installed: () => installed,
      onCall: (call) => calls.push(`${call.method} ${call.url} ${call.status}`),
    },
  );
  return { fetch, passedOn, calls };
}

describe("the e2e GitHub", () => {
  const { installation, repo } = E2E_GITHUB;

  it("has no installations until the App is installed", async () => {
    expect(
      await listUserInstallations("token", {
        fetch: fake({ installed: false }).fetch,
      }),
    ).toEqual([]);
    expect(
      await listUserInstallations("token", { fetch: fake().fetch }),
    ).toEqual([
      {
        id: installation.id,
        accountLogin: installation.account,
        accountType: "user",
      },
    ]);
  });

  it("lists the one repository and its branch", async () => {
    const { fetch } = fake();
    const repos = await listInstallationRepos("token", installation.id, {
      fetch,
    });
    expect(repos?.map((r) => [r.id, r.fullName, r.defaultBranch])).toEqual([
      [repo.id, `${repo.owner}/${repo.name}`, repo.defaultBranch],
    ]);
    expect(
      await listRepoBranches("token", repo.owner, repo.name, { fetch }),
    ).toEqual({
      names: [repo.defaultBranch],
      truncated: false,
    });
  });

  it("answers the sign-in token exchange", async () => {
    const response = await fake().fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        body: "code=e2e-code",
      },
    );
    expect(await response.json()).toMatchObject({
      access_token: E2E_GITHUB.accessToken,
    });
  });

  it("answers anything else on GitHub with a 404, and reports it", async () => {
    const { fetch, calls } = fake();
    const response = await fetch("https://api.github.com/repos/octocat/other");
    expect(response.status).toBe(404);
    expect(calls).toEqual([
      "GET https://api.github.com/repos/octocat/other 404",
    ]);
  });

  it("passes requests to other hosts on", async () => {
    const { fetch, passedOn, calls } = fake();
    expect(await (await fetch("http://localhost:6379/x")).text()).toBe("real");
    expect(passedOn).toEqual(["http://localhost:6379/x"]);
    expect(calls).toEqual([]);
  });
});
