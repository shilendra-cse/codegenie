import type { GitHubInstallation } from "@codegenie/shared";

export type InstallReturn = "add-repo";

export function installUrlFor(installUrl: string, returnTo: InstallReturn) {
  const url = new URL(installUrl);
  url.searchParams.set("state", returnTo);
  return url.toString();
}

export function manageAccessUrl({
  id,
  accountLogin,
  accountType,
}: GitHubInstallation) {
  return accountType === "organization"
    ? `https://github.com/organizations/${accountLogin}/settings/installations/${id}`
    : `https://github.com/settings/installations/${id}`;
}

export const repositoryUrl = (owner: string, name: string) =>
  `https://github.com/${owner}/${name}`;
