# GitHub

> Status: **In progress** (Phase 3) · Last updated: 2026-10-21 · Code: `packages/github` · Related: [architecture.md](./architecture.md) (D3), [development-plan.md](./development-plan.md) (Phase 3)

CodeGenie reaches GitHub through **one GitHub App**: users sign in with it, install it on the repositories CodeGenie may work on, and the worker gets short-lived tokens from it to clone, push and open pull requests as `<app-slug>[bot]`. No user's own GitHub token is used to touch repositories.

## 1. How access works

```
App ID + private key (ours, secret)
   │  sign a JWT ("I am App 123", valid 10 min)
   ▼
GitHub: installation 42 = "acme allowed the App into acme/api and acme/web"
   │  JWT + "token for installation 42, repo acme/api, contents: read"
   ▼
installation token ghs_…  (one repository, only those permissions, expires within 1 hour)
   │
   ▼
git clone / push, REST API calls
```

- **App** (registered once): its ID and private key prove "this is CodeGenie". The private key never leaves the server and the worker.
- **Installation**: an account or organization allowing the App into some or all of its repositories. Users choose; "All repositories" is one click.
- **Installation token**: what actually opens a repository. Minted per use, never stored.

## 2. Tokens

| Use | Permissions | Minted by | Where the token goes |
|---|---|---|---|
| Clone | `contents: read` | worker | only the `git clone` command; the remote is the plain URL afterwards |
| Push | `contents: write` | worker | only the `git push` command, after the agent has finished |
| Open the PR, read PR state | `pull_requests: write` | worker | the worker's API client, never the sandbox |
| Repo picker | the user's sign-in token (installations they can access) | server | server only |

Every token is scoped to **one repository** and expires within an hour. `repoToken` reuses a token until it has less than 5 minutes left. The agent has a shell in the sandbox, so a token is never left where it could read it (`.git/config`, the remote URL, the environment).

## 3. `@codegenie/github`

| Export | What it does |
|---|---|
| `createGithubApp({ appId, privateKey })` | The App client; one per process |
| `repoToken(installationId, repoId, permissions)` | A token for one repository with only those permissions, at least 5 minutes left |
| `repoClient(installationId, repoId, permissions)` | An Octokit client authenticated with such a token |
| `installationForRepo(owner, repo)` | The installation covering a repository, or `null` |
| `botIdentity()` | `{ name: "<slug>[bot]", email: "<id>+<slug>[bot]@users.noreply.github.com" }`: the commit author GitHub shows as the bot |
| `verifyWebhookSignature(secret, rawBody, signature)` | Checks `X-Hub-Signature-256` over the raw request body |
| `parsePrivateKey(value)` | The PEM key as downloaded, or on one line with `\n` |

Tests answer with GitHub's response shapes and sign real JWTs; nothing calls GitHub.

## 4. Registering the dev App

On GitHub: **Settings → Developer settings → GitHub Apps → New GitHub App** (under your account, or an organization's settings for an org-owned App).

| Field | Value |
|---|---|
| GitHub App name | unique on GitHub, e.g. `codegenie-dev-<you>`; it becomes the bot's name (`<name>[bot]`) |
| Homepage URL | `http://localhost:3000` |
| Callback URL | `http://localhost:3001/api/auth/callback/github` (sign-in) |
| Expire user authorization tokens | checked |
| Request user authorization (OAuth) during installation | unchecked |
| Setup URL | the server's install callback (added with the install flow; leave empty until then) |
| Redirect on update | checked |
| Webhook → Active | checked |
| Webhook URL | your smee.io channel (or tunnel) URL, forwarded to the server's webhook endpoint |
| Webhook secret | a long random string (`openssl rand -hex 32`) |
| Repository permissions | **Contents: Read and write**, **Pull requests: Read and write**, Metadata: Read-only (required) |
| Account permissions | **Email addresses: Read-only** (sign-in needs the user's email) |
| Subscribe to events | **Pull request** (installation events are always sent) |
| Where can this GitHub App be installed? | **Only on this account** for development, or **Any account** to install it on an organization |

After **Create GitHub App**:
1. Note the **App ID** and **Client ID** at the top of the App's page.
2. **Generate a new client secret** and copy it.
3. **Generate a private key**: a `.pem` file downloads.
4. **Install App** (left menu) on a test repository; a private one proves private access.

## 5. Settings

| Setting | Server | Worker | Added with |
|---|---|---|---|
| `GITHUB_APP_ID` | ✓ | ✓ | install flow / private clone |
| `GITHUB_APP_PRIVATE_KEY` (the `.pem` contents; one line with `\n` is fine) | ✓ | ✓ | install flow / private clone |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (the App's, for sign-in) | ✓ | | install flow |
| `GITHUB_WEBHOOK_SECRET` | ✓ | | install flow |

Keep the private key and secrets in the git-ignored `.env` files only.
