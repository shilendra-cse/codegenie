import { Octokit } from "@octokit/rest";

export type UserInstallation = {
  id: number;
  accountLogin: string;
  accountType: "user" | "organization";
};

export async function listUserInstallations(
  userToken: string,
  options: { fetch?: typeof fetch } = {},
): Promise<UserInstallation[]> {
  const octokit = new Octokit({
    auth: userToken,
    request: options.fetch ? { fetch: options.fetch } : {},
  });
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
