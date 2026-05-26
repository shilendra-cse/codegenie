import { db } from "@/db";
import { account } from "@/db/schema";
import { HttpError } from "@/lib/http-error";
import { and, eq } from "drizzle-orm";
import { Octokit } from "@octokit/rest";

export type GitHubRepoSummary = {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
};

async function getGitHubAccessToken(userId: string): Promise<string> {
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "github")),
  });

  if (!row?.accessToken) {
    throw new HttpError(
      403,
      "Github account not connected. Sign in with Github to continue.",
      "GITHUB_NOT_LINKED",
    );
  }

  // TODO: if accessTokenExpiresAt is past, refresh via Better Auth / refresh_token
  return row.accessToken;
}

async function getOctokitForUser(userId: string): Promise<Octokit> {
  const token = await getGitHubAccessToken(userId);
  return new Octokit({ auth: token });
}

export async function listRepos(userId: string): Promise<GitHubRepoSummary[]> {
  const octokit = await getOctokitForUser(userId);

  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: "updated" },
  );

  return repos.map((repo) => ({
    fullName: repo.full_name ?? `${repo.owner?.login}/${repo.name}`,
    owner: repo.owner?.login ?? "",
    name: repo.name ?? "",
    defaultBranch: repo.default_branch ?? "main",
    private: repo.private ?? false,
    htmlUrl: repo.html_url ?? "",
  }));
}
