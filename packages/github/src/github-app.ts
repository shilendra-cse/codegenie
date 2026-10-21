import { createAppAuth } from "@octokit/auth-app";
import { request as defaultRequest } from "@octokit/request";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { parsePrivateKey } from "./private-key.js";

const MIN_TOKEN_LIFETIME_MS = 5 * 60_000;

export type GithubAppConfig = {
  appId: number | string;
  privateKey: string;
};

export type RepoPermissions = Partial<
  Record<"contents" | "pull_requests" | "metadata", "read" | "write">
>;

export type RepoToken = { token: string; expiresAt: Date };

export type GithubApp = {
  repoToken(
    installationId: number,
    repoId: number,
    permissions: RepoPermissions,
  ): Promise<RepoToken>;
  repoClient(
    installationId: number,
    repoId: number,
    permissions: RepoPermissions,
  ): Promise<Octokit>;
  installationForRepo(owner: string, repo: string): Promise<number | null>;
};

export function createGithubApp(
  config: GithubAppConfig,
  options: { fetch?: typeof fetch } = {},
): GithubApp {
  const requestOptions = options.fetch ? { fetch: options.fetch } : {};
  const request = defaultRequest.defaults({ request: requestOptions });
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: parsePrivateKey(config.privateKey),
    request,
  });

  const repoToken: GithubApp["repoToken"] = async (
    installationId,
    repoId,
    permissions,
  ) => {
    const mint = (refresh: boolean) =>
      auth({
        type: "installation",
        installationId,
        repositoryIds: [repoId],
        permissions,
        refresh,
      });
    let minted = await mint(false);
    if (Date.parse(minted.expiresAt) - Date.now() < MIN_TOKEN_LIFETIME_MS) {
      minted = await mint(true);
    }
    return { token: minted.token, expiresAt: new Date(minted.expiresAt) };
  };

  return {
    repoToken,

    async repoClient(installationId, repoId, permissions) {
      const { token } = await repoToken(installationId, repoId, permissions);
      return new Octokit({ auth: token, request: requestOptions });
    },

    async installationForRepo(owner, repo) {
      const { token } = await auth({ type: "app" });
      try {
        const { data } = await request(
          "GET /repos/{owner}/{repo}/installation",
          { owner, repo, headers: { authorization: `bearer ${token}` } },
        );
        return data.id;
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) return null;
        throw error;
      }
    },
  };
}
