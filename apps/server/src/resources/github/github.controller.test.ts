import type { Response } from "express";
import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/http-error";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createGithubControllers } from "./github.controller";

const installation = {
  id: 42,
  account: { login: "acme", type: "Organization" },
};
const repo = (id: number, name: string, updatedAt: string) => ({
  id,
  name,
  full_name: `acme/${name}`,
  owner: { login: "acme" },
  default_branch: "main",
  private: true,
  html_url: `https://github.com/acme/${name}`,
  updated_at: updatedAt,
});

const githubFetch: typeof fetch = (input) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  const body =
    url.pathname === "/user/installations"
      ? { total_count: 1, installations: [installation] }
      : url.pathname === "/user/installations/42/repositories"
        ? {
            total_count: 2,
            repositories: [
              repo(1, "old", "2026-01-01T00:00:00Z"),
              repo(2, "new", "2026-10-01T00:00:00Z"),
            ],
          }
        : { message: "Not Found" };
  const response = new Response(JSON.stringify(body), {
    status: "message" in body ? 404 : 200,
    headers: { "content-type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url.href });
  return Promise.resolve(response);
};

function controllers(token: string | null = "ghu_user") {
  return createGithubControllers({
    githubToken: () => Promise.resolve(token),
    installUrl: () =>
      Promise.resolve(
        "https://github.com/apps/codegenie-dev/installations/new",
      ),
    fetch: githubFetch,
  });
}

const request = (params: Record<string, string> = {}) =>
  ({
    user: { id: "user-1", email: "ada@example.com" },
    params,
  }) as unknown as AuthenticatedRequest;
const response = {} as Response;

describe("GitHub controllers", () => {
  it("lists the user's installations with the install link", async () => {
    expect(
      await controllers().getInstallations(request(), response),
    ).toMatchObject({
      status: 200,
      data: {
        installations: [
          { id: 42, accountLogin: "acme", accountType: "organization" },
        ],
        installUrl: "https://github.com/apps/codegenie-dev/installations/new",
      },
    });
  });

  it("lists an installation's repositories, most recently updated first", async () => {
    const result = await controllers().getInstallationRepositories(
      request({ id: "42" }),
      response,
    );
    expect(result).toMatchObject({
      status: 200,
      data: {
        repositories: [
          { id: 2, fullName: "acme/new" },
          { id: 1, fullName: "acme/old" },
        ],
      },
    });
  });

  it.each([
    ["no GitHub token", null, "42", 401, "GITHUB_SIGN_IN_REQUIRED"],
    [
      "someone else's installation",
      "ghu_user",
      "99",
      404,
      "GITHUB_INSTALLATION_NOT_FOUND",
    ],
    ["an invalid id", "ghu_user", "abc", 400, undefined],
  ])("refuses %s", async (_case, token, id, status, code) => {
    const failure = controllers(token).getInstallationRepositories(
      request({ id }),
      response,
    );
    await expect(failure).rejects.toBeInstanceOf(HttpError);
    await expect(failure).rejects.toMatchObject({ status, code });
  });
});
