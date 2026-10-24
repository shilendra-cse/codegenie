import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";

const silent = () => {};

// Failures are thrown to the caller, so Octokit's own logging would only repeat them.
function userClient(userToken: string, fetch?: typeof globalThis.fetch) {
  return new Octokit({
    auth: userToken,
    request: fetch ? { fetch } : {},
    log: { debug: silent, info: silent, warn: silent, error: silent },
  });
}

export type UserInstallation = {
  id: number;
  accountLogin: string;
  accountType: "user" | "organization";
};

export async function listUserInstallations(
  userToken: string,
  options: { fetch?: typeof fetch } = {},
): Promise<UserInstallation[]> {
  const octokit = userClient(userToken, options.fetch);
  const installations = await octokit.paginate(
    octokit.rest.apps.listInstallationsForAuthenticatedUser,
    { per_page: 100 },
  );
  return installations.flatMap((installation) =>
    installation.account && "login" in installation.account
      ? [
          {
            id: installation.id,
            accountLogin: installation.account.login,
            accountType:
              installation.account.type === "Organization"
                ? "organization"
                : "user",
          },
        ]
      : [],
  );
}

export type InstallationRepo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  updatedAt: string | null;
  language: string | null;
};

export async function listInstallationRepos(
  userToken: string,
  installationId: number,
  options: { fetch?: typeof fetch } = {},
): Promise<InstallationRepo[] | null> {
  const octokit = userClient(userToken, options.fetch);
  let repos;
  try {
    repos = await octokit.paginate(
      octokit.rest.apps.listInstallationReposForAuthenticatedUser,
      { installation_id: installationId, per_page: 100 },
    );
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return null;
    throw error;
  }
  return repos.map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
    private: repo.private,
    htmlUrl: repo.html_url,
    updatedAt: repo.updated_at ?? null,
    language: repo.language ?? null,
  }));
}

export type RepoBranches = { names: string[]; truncated: boolean };

/** The repository's branch names, as GitHub lists them, up to `limit`; null when the user can't see it. */
export async function listRepoBranches(
  userToken: string,
  owner: string,
  repo: string,
  options: { fetch?: typeof fetch; limit?: number } = {},
): Promise<RepoBranches | null> {
  const limit = options.limit ?? 1000;
  const octokit = userClient(userToken, options.fetch);
  const names: string[] = [];
  let truncated = false;
  try {
    await octokit.paginate(
      octokit.rest.repos.listBranches,
      { owner, repo, per_page: 100 },
      (response, done) => {
        for (const branch of response.data) {
          if (names.length === limit) {
            truncated = true;
            break;
          }
          names.push(branch.name);
        }
        if (truncated) done();
        return [];
      },
    );
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return null;
    throw error;
  }
  return { names, truncated };
}
