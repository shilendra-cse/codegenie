/** The GitHub the end-to-end test signs in to: one user, one installation, one public repository. */
export const E2E_GITHUB = {
  appSlug: "hobai-e2e",
  accessToken: "gho_e2etoken0123456789abcdefghijklmnopqr",
  user: {
    id: 583231,
    login: "ada-e2e",
    name: "Ada Lovelace",
    email: "ada@example.com",
  },
  installation: { id: 4242, account: "octocat" },
  // A real public repository, so the sandbox can clone it without credentials.
  repo: {
    id: 1296269,
    owner: "octocat",
    name: "Hello-World",
    defaultBranch: "master",
  },
} as const;

const HOSTS = new Set(["github.com", "api.github.com"]);

type Reply = { status: number; body: unknown };

function answer(method: string, path: string, installed: boolean): Reply {
  const { user, installation, repo } = E2E_GITHUB;
  const fullName = `${repo.owner}/${repo.name}`;
  const route = `${method} ${path}`;
  switch (route) {
    case "POST /login/oauth/access_token":
      return {
        status: 200,
        body: {
          access_token: E2E_GITHUB.accessToken,
          token_type: "bearer",
          scope: "read:user,user:email",
        },
      };
    case "GET /user":
      return {
        status: 200,
        body: { ...user, avatar_url: null, type: "User" },
      };
    case "GET /user/emails":
      return {
        status: 200,
        body: [{ email: user.email, primary: true, verified: true }],
      };
    case "GET /app":
      return { status: 200, body: { slug: E2E_GITHUB.appSlug } };
    case "GET /user/installations":
      return {
        status: 200,
        body: {
          total_count: installed ? 1 : 0,
          installations: installed
            ? [
                {
                  id: installation.id,
                  account: { login: installation.account, type: "User" },
                },
              ]
            : [],
        },
      };
    case `GET /user/installations/${installation.id}/repositories`:
      return {
        status: 200,
        body: {
          total_count: 1,
          repositories: [
            {
              id: repo.id,
              full_name: fullName,
              owner: { login: repo.owner },
              name: repo.name,
              default_branch: repo.defaultBranch,
              private: false,
              html_url: `https://github.com/${fullName}`,
              updated_at: "2026-10-01T00:00:00Z",
              language: null,
            },
          ],
        },
      };
    case `GET /repos/${fullName}/branches`:
      return { status: 200, body: [{ name: repo.defaultBranch }] };
    default:
      return { status: 404, body: { message: "Not Found" } };
  }
}

export type E2eGithubOptions = {
  /** Whether the App is installed yet; the user's installations are empty until it is. */
  installed: () => boolean;
  /** Told of each GitHub call, so an unexpected one shows in the logs. */
  onCall: (call: { method: string; url: string; status: number }) => void;
};

/** A fetch that answers GitHub's sign-in and API calls as `E2E_GITHUB` and passes every other request to `realFetch`. */
export function e2eGithubFetch(
  realFetch: typeof globalThis.fetch,
  { installed, onCall }: E2eGithubOptions,
): typeof globalThis.fetch {
  return (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!HOSTS.has(url.hostname)) return realFetch(input, init);
    const { status, body } = answer(request.method, url.pathname, installed());
    onCall({ method: request.method, url: url.href, status });
    const response = new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
    // Octokit reads the URL off the response, which a constructed Response doesn't have.
    Object.defineProperty(response, "url", { value: url.href });
    return Promise.resolve(response);
  };
}
