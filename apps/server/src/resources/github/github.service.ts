import { db } from "@/db";
import { getGithubAccount } from "@codegenie/db";
import { auth } from "@/lib/auth";
import { HttpError } from "@/lib/http-error";
import { Octokit } from "@octokit/rest";

export type GitHubRepoSummary = {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
};

export async function githubAccessToken(
  userId: string,
): Promise<string | null> {
  try {
    const tokens = await auth.api.getAccessToken({
      body: { providerId: "github", userId },
    });
    return tokens.accessToken ?? null;
  } catch {
    return null;
  }
}

async function getGitHubAccessToken(userId: string): Promise<string> {
  const token = await githubAccessToken(userId);
  if (!token) {
    throw new HttpError(
      403,
      "Github account not connected. Sign in with Github to continue.",
      "GITHUB_NOT_LINKED",
    );
  }
  return token;
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

export async function isGitHubLinked(userId: string): Promise<boolean> {
  const row = await getGithubAccount(db, userId);
  return Boolean(row?.accessToken);
}
