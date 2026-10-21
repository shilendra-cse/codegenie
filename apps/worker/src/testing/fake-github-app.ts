import type { GithubApp, RepoPermissions } from "@codegenie/github";

export const FAKE_REPO_TOKEN = "ghs_faketoken0123456789abcdefghijklmnop";

export function fakeGithubApp(token = FAKE_REPO_TOKEN) {
  const requests: {
    installationId: number;
    repoId: number;
    permissions: RepoPermissions;
  }[] = [];
  const github: Pick<GithubApp, "repoToken"> = {
    repoToken(installationId, repoId, permissions) {
      requests.push({ installationId, repoId, permissions });
      return Promise.resolve({
        token,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
    },
  };
  return { github, requests };
}
