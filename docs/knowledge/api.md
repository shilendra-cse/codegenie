# API

> Status: **In progress** (Phase 4) · Last updated: 2026-10-22 · Code: `apps/server` · Reference: `docs/api/openapi.yaml` (served at `/api/docs`) · Related: [ui.md](./ui.md) (what each screen needs), [github.md](./github.md) §6

The HTTP API behind the web app. The OpenAPI file has every request and response; this page has the rules they share.

## 1. Conventions

- **Base path** `/api`. JSON in and out.
- **Auth:** the Better Auth session cookie from signing in with GitHub. Every route needs it unless marked public; without it: **401**.
- **Success:** `{ status, message, type: "success", data }`.
- **Error:** `{ status, message, type: "error", code?, data? }`. `code` is stable and machine-readable; `message` is for people. A request that fails validation answers **400** with `data` holding zod's field errors.
- **Ids:** CodeGenie's own ids are UUIDs; GitHub's ids (installations, repositories) are numbers and named as such (`installationId`, `repoId`, `githubId`).
- **Dates:** ISO 8601 strings.

## 2. Ownership

Every project, task and run belongs to one user. A route loads it **together with the signed-in user's id**, so someone else's resource and a missing one both answer **404** with the same code: ids of other people's things are never confirmed to exist. Nothing else checks access.

## 3. Error codes

| Code | Status | Meaning |
|---|---|---|
| `GITHUB_SIGN_IN_REQUIRED` | 401 | No usable GitHub token for the user; sign in again |
| `GITHUB_INSTALLATION_NOT_FOUND` | 404 | The installation isn't recorded, was uninstalled, or the user can't access it |
| `GITHUB_INSTALLATION_SUSPENDED` | 409 | The App is suspended on that account |
| `GITHUB_REPOSITORY_NOT_FOUND` | 404 | The repository isn't visible to the user through that installation |
| `PROJECT_NOT_FOUND` | 404 | Not one of the user's projects, or doesn't exist |
| `PROJECT_BUSY` | 409 | A run is queued or running on the project |

## 4. Resources

| Method | Path | |
|---|---|---|
| GET | `/github/installations` | The user's installations and the install link ([github.md](./github.md) §6) |
| GET | `/github/installations/:id/repositories` | Repositories the user can access there, each with its `projectId` or `null` |
| GET | `/projects` | The user's projects, newest first |
| POST | `/projects` | `{ installationId, repoId }` → 201 created, or 200 with the existing project |
| GET | `/projects/:id` | One project |
| DELETE | `/projects/:id` | Removes it with its tasks, runs and environments; GitHub untouched |

A **project** is its repository (`githubId`, `owner`, `name`), default branch, active environment (`version`, `health`, `healthReasons`, `savedAt`, or `null` until set up) and installation state (`accountLogin`, `suspended`, `uninstalled`).

**Adding a project** checks, in order: the installation is recorded and installed (404), not suspended (409), the user has a GitHub token (401), GitHub shows the user that installation (404) and the repository in it (404). The project belongs to the signed-in user, whoever installed the App; the repository's owner, name and default branch come from GitHub at that moment.

**Removing a project** is refused while one of its runs is queued or running; the check and the delete are one statement, so a run queued in between can't be orphaned.

Tasks, runs, run events and the environment come next ([development-plan.md](./development-plan.md), Phase 4).

## 5. Code layout

```
apps/server/src/resources/<name>/
  <name>.routes.ts        paths on the shared ApiRouter
  <name>.controller.ts    parse the request (zod), call services, wrap in the envelope
  <name>.types.ts         zod schemas, response types and mappers
  services/<fn>.service.ts  one function each: rules, HttpErrors, response shapes
```

Services call queries from `@codegenie/db`; a query that returns a row or `null` is named `find…`, and the service that turns "not found" into a 404 is named `get…`. Controllers are created from their dependencies (`createProjectControllers({ db, githubToken })`), so tests pass fakes for GitHub and a real test database.
