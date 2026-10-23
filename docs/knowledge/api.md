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
| `GITHUB_INSTALLATION_REMOVED` | 409 | The App was uninstalled from the project's account; no new work can start |
| `GITHUB_REPOSITORY_NOT_FOUND` | 404 | The repository isn't visible to the user through that installation |
| `PROJECT_NOT_FOUND` | 404 | Not one of the user's projects, or doesn't exist |
| `PROJECT_BUSY` | 409 | A run is queued or running on the project |
| `PROJECT_NOT_SET_UP` | 409 | The project has no environment yet; set it up first |
| `PROJECT_NEEDS_ATTENTION` | 409 | The project's setup needs attention; re-run setup first |
| `TASK_NOT_FOUND` | 404 | Not one of the user's tasks, or doesn't exist |
| `RUN_NOT_FOUND` | 404 | Not a run on one of the user's tasks, or doesn't exist |
| `RUN_ENDED` | 409 | The run has already ended, so it can't be cancelled |
| `ONBOARDING_NOT_FOUND` | 404 | The project has never been set up, so there's no setup to answer or stop |
| `ONBOARDING_ENDED` | 409 | The setup has already ended, so it can't be stopped |
| `QUESTION_NOT_OPEN` | 409 | The setup isn't waiting on that question (answered, timed out, stopped, or a different one) |
| `QUEUE_UNAVAILABLE` | 503 | Work couldn't be queued (Redis unreachable); a task's run is marked failed (`queue_unavailable`) |

## 4. Resources

| Method | Path | |
|---|---|---|
| GET | `/github/installations` | The user's installations and the install link ([github.md](./github.md) §6) |
| GET | `/github/installations/:id/repositories` | Repositories the user can access there (most recently updated first), each with its `language` and its `projectId`, or `null` |
| GET | `/projects` | The user's projects, newest first |
| POST | `/projects` | `{ installationId, repoId }` → 201 created, or 200 with the existing project |
| GET | `/projects/:id` | One project |
| DELETE | `/projects/:id` | Removes it with its tasks, runs and environments; GitHub untouched |
| POST | `/projects/:id/onboarding` | Records a setup and queues it: 202 `{ onboarding }`; while one is queued, running or waiting, that one is returned |
| GET | `/projects/:id/onboarding` | The latest setup with its open question, or `null` |
| POST | `/projects/:id/onboarding/answer` | `{ questionId, answer: { option } \| { other } }` → 202; checked against the open question, then handed to the worker |
| POST | `/projects/:id/onboarding/cancel` | 202 `{ outcome: "cancelled" }` for a queued setup, `"stopping"` for a running or waiting one |
| GET | `/projects/:id/environments` | The saved environment versions, newest (active) first |
| POST | `/projects/:id/tasks` | `{ prompt, baseBranch? }` → 201 `{ task, run }`, the run queued |
| GET | `/tasks?projectId=&cursor=` | The user's tasks, newest first, 50 per page, with `nextCursor` |
| GET | `/tasks/:id` | A task with its messages and runs |
| GET | `/runs/:id` | One run |
| GET | `/runs/:id/diff` | The run's patch and files, or `null` |
| POST | `/runs/:id/cancel` | 202 `{ outcome: "cancelled" }` for a queued run, `"stopping"` for a running one |
| GET | `/runs/:id/events` | The run's events as a stream (server-sent events), replayed then live (§6) |

A **project** is its repository (`githubId`, `owner`, `name`), default branch, active environment (`version`, `health`, `healthReasons`, `savedAt`, or `null` until set up) and installation state (`accountLogin`, `suspended`, `uninstalled`).

**Adding a project** checks, in order: the installation is recorded and installed (404), not suspended (409), the user has a GitHub token (401), GitHub shows the user that installation (404) and the repository in it (404). The project belongs to the signed-in user, whoever installed the App; the repository's owner, name and default branch come from GitHub at that moment.

**Removing a project** is refused while one of its runs is queued or running; the check and the delete are one statement, so a run queued in between can't be orphaned.

**Starting work** (a task or setup) needs the App installed and not suspended (409); a task also needs the environment set up and healthy (409). The task's title is the prompt's first line (≤ 120 characters), its base branch the project's default unless given, and its run records the server's `AGENT_MODEL`. The database is written first, then the queue; if Redis can't be reached the run is failed and the request answers 503.

A **task** in a list: `id`, `title`, `project` (`id`, `owner`, `name`), `label`, `baseBranch`, `branchName`, `pullRequest` (`number`, `url`, `draft`, or `null`), `latestRun` (`id`, `status`, `stage`, `error`), `runCount`, `durationMs` and `costUsd` across runs, `createdAt`, `updatedAt` (latest activity). Its **label**, in order: latest run queued → `queued`, running → `working`; PR merged → `merged`, closed → `closed`, open → `pr_open` / `pr_draft`; latest run failed → `failed`, cancelled → `cancelled`; otherwise `no_changes` ([ui.md](./ui.md) §5). Pages are cursored by the last task's id. The task detail adds `messages` (oldest first) and `runs` (newest first).

A **run**: `id`, `taskId`, `trigger`, `status`, `stage`, `model`, `summary`, `checksPassed`, `commitSha`, `error` (`code`, `message`, or `null`), `steps`, `inputTokens`, `outputTokens`, `costUsd`, `queuedAt`, `startedAt`, `finishedAt`, `durationMs`, `changes` (`files`, `truncated`, or `null`; the patch comes from `/runs/:id/diff`).

**Cancelling** a queued run marks it `cancelled` directly; a running one is told to stop over Redis (`run-cancel`) and ends `cancelled` once the worker stops it.

A **setup** (onboarding): `id`, `status` (`queued`, `running`, `waiting` for an answer, `succeeded`, `failed`, `cancelled`), `question` (the open one while `waiting`: `id`, `question`, `why`, `options` with the recommended one first, `allowOther`), `environmentVersion` (what it saved), `error` (`code`, `message`; e.g. `NO_ANSWER` after 30 minutes without one), tokens, `costUsd`, `queuedAt`, `startedAt`, `finishedAt`, `durationMs` ([environment.md](./environment.md) §3.5). **Answering** requires the setup to be `waiting` on that question (409 `QUESTION_NOT_OPEN` otherwise), an existing option or, where allowed, 1–2000 characters of your own (400 otherwise); the answer goes to the worker over Redis (`onboarding-answer`). **Stopping** works like cancelling a run, over `run-cancel` with the setup's id.

An **environment version**: `version`, `active`, `source`, `savedAt`, `health`, `healthReasons`, `steps`, `checks`, `decisions` (the questions asked and how they were answered). Rollback to an older version comes with the project page.

## 5. Code layout

```
apps/server/src/resources/<name>/
  <name>.routes.ts        paths on the shared ApiRouter
  <name>.controller.ts    parse the request (zod), call services, wrap in the envelope
  <name>.types.ts         zod schemas, response types and mappers
  services/<fn>.service.ts  one function each: rules, HttpErrors, response shapes
```

A route whose handler writes its own response (a stream) wraps it: `api.get(path).authSecure(stream(handler))`. `lib/sse.ts` opens the connection (`openSse`), formats frames, and ends the response; an error before streaming still becomes a normal JSON error.

Services call queries from `@codegenie/db`; a query that returns a row or `null` is named `find…`, and the service that turns "not found" into a 404 is named `get…`. Controllers are created from their dependencies (`createProjectControllers({ db, githubToken })`), so tests pass fakes for GitHub and a real test database.

## 6. Run events stream

`GET /api/runs/:id/events` keeps one HTTP response open and writes the run's events to it as they happen ([server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)). In the browser, `new EventSource(url, { withCredentials: true })`.

```
id: 1
data: {"type":"stage_changed","stage":"prepare","runId":"…","seq":1,"ts":"…"}

data: {"type":"text_delta","delta":"Reading the routes","runId":"…","ts":"…"}

: ping

id: 9
data: {"type":"done","status":"succeeded","runId":"…","seq":9,"ts":"…"}
```

- **`data`** is a `RunEvent` (`packages/shared`), the same JSON the worker publishes. **`id`** is its `seq`: stored events are numbered 1, 2, 3…; live-only events (`text_delta`, `agent_step`) have no id and aren't replayed.
- **Resuming:** `Last-Event-ID: <seq>` (sent by `EventSource` itself on reconnect) or `?after=<seq>` starts after that event. Without either, the whole run is replayed.
- **Order of work:** the server listens on the run's Redis channel first, then replays stored events from `run_events` 500 at a time, then forwards live ones. Each stored event is sent once; a jump in `seq` is filled from `run_events`.
- **Ending:** after the `done` event, or as soon as the run has ended without one (e.g. a queued run that was cancelled). A `: ping` every 15 s keeps proxies from closing the connection and re-checks the run's status. `EventSource` reconnects when a stream ends, so clients close it on `done`.
- **Errors** before streaming are normal JSON: 401, 404 `RUN_NOT_FOUND`, 400 for a bad `Last-Event-ID`.
- **Redis:** one subscriber connection per server, shared by every viewer; it subscribes to `run:{id}` for a run's first viewer and unsubscribes after its last (`lib/run-event-hub.ts`).
