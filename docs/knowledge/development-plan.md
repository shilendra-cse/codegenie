# Development Plan

> Status: **Accepted** · Last updated: 2026-10-13 · Related: [requirements.md](./requirements.md), [architecture.md](./architecture.md), [database.md](./database.md)

## 1. Approach

- **Inside out:** agent first, then the infrastructure around it (worker, sandbox, GitHub), then the UI. Agent reliability is the biggest risk, so it gets tested earliest.
- **Local first:** a Docker sandbox lets Phases 0–1 run with no accounts beyond an LLM key.
- **Every phase ends in a runnable demo** and a "done when" check tied to the requirements.
- **Measure the agent:** an eval set is built in Phase 1 and re-run on every agent change.

```
Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ─► Phase 5 (MVP launch) ─► Phase 6+
Foundations  Agent     Worker +    GitHub     API + UI    Deploy, follow-ups,
             core      Daytona     App                    quotas, hardening
```

## 2. Phases

### Phase 0 — Foundations
**Goal:** repo in its final shape, new schema in place, CI guarding `main`.

- [x] CI on GitHub Actions: lint, type-check, Vitest on every PR.
- [x] Add Vitest to the workspace.
- [x] Cleanup: root `g`/`pnpm` deps, unused JWT/bcrypt config, stale README, web metadata.
- [x] Package skeletons: `packages/sandbox`, `packages/agent`, `apps/worker`.
- [x] New Drizzle schema per [database.md](./database.md); delete `0000`/`0001`; generate one clean initial migration.
- [x] Update `packages/shared` types (Task, Run, Message, RunEvent, enums) to match the schema.
- [x] Remove `WORKSPACES_ROOT` / `lib/workspaces.ts`.

**Done when:** CI is green on `main`; `pnpm setup` from scratch produces a migrated DB; `pnpm dev:*` runs.

### Phase 1 — Agent core (local)
**Goal:** the agent completes mid-sized JS/TS tasks against a local Docker sandbox.

- [x] `Sandbox` interface + `DockerSandbox` (`exec`, `readFile`, `writeFile`, `listFiles`, `destroy`).
- [x] Base image: git, ripgrep, fd, Node + corepack (npm/pnpm/yarn). bun deferred (see [sandbox.md](./sandbox.md) TODO).
- [x] Tools rebuilt on `Sandbox` in `packages/agent` ([agent.md](./agent.md)): `list_files`, `read_file`, `search`, `edit_file` (unique match), `write_file`, `bash`, `run_checks`, `finish_task`; output truncation.
- [x] Agent loop: native SDK tool messages, model catalog (platform-controlled), step/time/cost limits with forced wrap-up, stop only on `finish_task`, `AbortSignal` cancellation, cache-friendly context compaction ([agent.md](./agent.md)).
- [x] Environment setup in `packages/runner` (setup stage): pluggable ecosystem detection (Node), package manager, frozen-then-fallback install, lint/typecheck/test/build checks; result passed to the agent's prompt and `run_checks`; `AGENTS.md` read into the prompt ([runner.md](./runner.md)). `.codegenie.yml` deferred.
- [x] Dev harness: `pnpm agent:run --repo <path|url> --task "…"` (`apps/cli`) running a task end to end via the runner (`runTask`: sandbox, checkout, setup, baseline, agent, verify, diff); config in `apps/cli/.env`; `apps/agent` removed ([runner.md](./runner.md)).
- [x] **Environment onboarding** ([environment.md](./environment.md)): a per-repository environment config created once through a guided conversation and replayed by every run.
  - [x] **A.** Config type + schema; `apply` / `validate`; runs replay the config (`--environment`, `--save-environment`); baseline check run + before/after comparison in verify (`--no-baseline-checks`); files written by the first check run are part of the baseline, and the diff is taken before verify; rules-only draft, auto-approved inside the run. Standalone setup comes with D.
  - [x] **B.** Multi-project draft rules (workspaces, independent sub-projects, orchestration-only root).
  - [x] **C.** Setup agent (`try_environment`, `ask_user`, `finish_setup`); onboarding pipeline; fresh-sandbox final check; terminal and auto channels; basic `pnpm agent:setup --save <file>`.
    - [x] **C1.** Setup agent and its tools on a loop shared with the task agent.
    - [x] **C2.** Onboarding pipeline, final check, channels, `agent:setup`.
  - [x] **D.** `EnvironmentStore` + CLI file store (last 5 versions, repo keys); `agent:setup` saves per repository and `--show`s it; `agent:run` loads it and stops without one; health signals (failed step, uncovered project folder); `--install` / `--no-install` / `--check` / `--save-environment` removed.
- [x] **Eval set** ([evals.md](./evals.md)): ≥ 10 mid-sized tasks across ≥ 3 JS/TS repos (DoDesk, BuyerBook, plus small fixture projects); onboarding in `--yes` mode; `pnpm eval` reports pass rate, checks-pass rate (fixed / regressed), setup outcomes, time, cost.
  - [x] **E1.** Harness (`apps/evals`: tasks, hidden-tests / checks / manual graders, report), fixture repos `ts-lib` and `http-api` with 3 tasks.
  - [x] **E2.** DoDesk (5) and BuyerBook (2) tasks at pinned commits, each with a reference solution; 10 tasks in total.
  - [x] First full run with the real model: 10 of 10 solved, $0.0214, 25m ([evals.md](./evals.md)). Next: harder tasks, `--repeat` runs.
  - [x] Progress while running: stage lines, per-task log files, live view ([evals.md](./evals.md)).
- [x] **Terminal UI** for `agent:run`, `agent:setup` and `pnpm eval`: colors, sections, spinners, arrow-key setup questions; shared `packages/terminal` ([runner.md](./runner.md)).

**Done when:** eval runs end-to-end locally and produces a baseline score. (Targets from requirements §6 are tracked from here on.)

### Phase 2 — Worker, queue, Daytona
**Goal:** a queued run goes through the full pipeline in a Daytona sandbox, with events persisted and published.

Decisions:
- The database code moves to `packages/db` so the server and the worker share one schema ([architecture.md](./architecture.md)).
- The worker is built and tested with Docker sandboxes first; Daytona comes after it (needs a Daytona account and API key by then).
- The worker can onboard a project (`onboard-project` work, recommended answers like `agent:setup --yes`): the only way to set a project up before the website. Interactive onboarding in the browser stays in Phase 4.
- The worker side of cancellation (a Redis message aborts the run and removes the sandbox) comes now; the Cancel button and API in Phase 4.
- Public repositories only: private ones need the GitHub App token (Phase 3).

Branches, each built in small batches (see Ways of working):

- [x] **1. `refactor/db-package`** — move only, no behavior change.
  1. `packages/db`: Drizzle schema, migrations, `drizzle.config` and `createDb(url)` moved from `apps/server/src/db/`; the server imports `@codegenie/db`; db scripts run from the package. (Planned as two batches; one, since a half-moved schema doesn't compile.)
  2. Docs.
- [x] **2. `feat/db-environments`** — environments in Postgres, the same `EnvironmentStore` as the CLI's file store, keyed by project id ([database.md](./database.md)).
  1. Schema + migration: `project_environments`, `runs.environment_id`, drop `projects.setup_config` if present.
  2. `DbEnvironmentStore`: load, list, save (new active version, previous superseded, one transaction), markHealth; tests on a fresh Postgres database per run (`@codegenie/db/testing`), and a Postgres service in CI.
  3. Docs.
- [x] **3. `feat/worker-queue`** — the worker, on Docker sandboxes. (Two PRs: `feat/worker-queue` for 1–4 and `feat/worker-consumer` for 5–8, with `refactor/job-to-run` between them renaming jobs to runs.)
  1. Queue contract in `shared`: queue name, work kinds (`run-task`, `onboard-project`), payloads.
  2. Event sink: every event into `run_events` (`seq` 1, 2, 3…) and published on Redis `run:{id}`; `text_delta` and `agent_step` published only.
  3. Run lifecycle: `runs` status, stage, sandbox id, environment version, summary, usage, errors, timestamps.
  4. `run-task` handler: load run, task, project and the active environment (clear error without one); `runTask`; record the result; mark health.
  5. `onboard-project` handler: `runOnboarding` with recommended answers; save as the project's next environment version; progress published live on `project:{id}:onboarding` (not stored); throws when onboarding fails.
  6. BullMQ consumer: concurrency, cancellation via Redis, no retry for work whose worker died; worker process: config, logger, graceful shutdown. Per-run limits (30 min / 150 steps / $2) are the agent's defaults. (Planned as one batch; two: consumer, then process.)
  7. `pnpm worker:enqueue onboard | run | cancel` for public repositories (dev tooling in `apps/worker/src/dev/`, moves to the API in Phase 4); end-to-end test of onboarding and a run through Docker, Postgres and Redis; Redis in CI.
  8. Docs.
- [x] **4. `feat/daytona-sandbox`** ([sandbox.md](./sandbox.md) §7).
  1. `DaytonaSandbox` (exec, files, destroy), designed from a probe of the real API and tested with a fake built from its recorded answers.
  2. `SANDBOX_PROVIDER=docker|daytona` in the worker and `createSandbox`; sandboxes labelled by run or onboarding for the reaper.
  3. `pnpm sandbox:build-snapshot`: `codegenie-base` built on Daytona from the same Dockerfile, then checked.
  4. ~~Integration test against Daytona~~: dropped, no automated tests against real Daytona (cost). Checked by hand instead: onboarding and a run of `octocat/Hello-World` through the worker on Daytona. Added the worker's start / finish / outcome logs, which that run showed were missing.
  5. Docs.
- [x] **5. `feat/reaper`**: three PRs (`feat/reaper` with run diffs, `refactor/query-layer`, `feat/reaper-lost-runs`).
  1. `run_diffs`: every run's diff is saved.
  2. Lost runs: `running` with no active queue item (`worker_lost`) and `queued` over 15 minutes with the item gone (`lost_in_queue`) are failed, with `error` + `done` events.
  3. Their work is kept: the diff is saved from the sandbox, which is parked (Daytona: stopped, deleted after `SANDBOX_RETENTION_HOURS`; Docker: deleted). Orphaned sandboxes are no longer deleted by us: Daytona's auto-stop and retention remove them.
  4. Scheduling: a `reap` work item every 5 minutes (one shared job scheduler) and at startup.
  5. Docs.

**Done when:** a script-enqueued run executes in Daytona, events appear in Redis and Postgres, and the sandbox is always deleted — including on failure and kill. **Done (2026-10-21):** checked by hand on Daytona; on a kill, the sandbox is parked for `SANDBOX_RETENTION_HOURS` and then deleted by Daytona (by decision, so the run could be resumed).
**Needs:** Daytona account (branch 4).
**Known issue:** production builds of the server and worker don't run yet (`tsc` keeps the `@/…` path aliases, which plain Node can't resolve; development runs through `tsx`). Fixed with the deploy work in Phase 5.

### Phase 3 — GitHub App & delivery
**Goal:** a run on a real repository, private ones included, ends in a pull request opened by `codegenie[bot]`, using only short-lived tokens scoped to that repository. *(U1, U2, U6 backend)*

Decisions:
- **One GitHub App** for sign-in and repository access: its OAuth signs users in, its installations give repo access. No separate OAuth App.
- **GitHub-only sign-in** for the MVP: email/password and Google are removed. Every user needs GitHub anyway; one identity means no account linking; it raises the bar for throwaway accounts. Better Auth keeps other providers a configuration change away.
- **Repository access through installations, not the user's OAuth token.** Tokens are minted per run for one repository with only the permissions needed (`contents: read` to clone, `contents: write` to push, `pull_requests: write` for the PR) and expire within an hour. A leaked token reaches one repository for less than an hour, instead of every repository the user can touch, indefinitely.
- **The repo picker lists installations and their repositories** the user can access (`/user/installations`, `/user/installations/{id}/repositories`), with an "adjust access" link to GitHub; installing on "All repositories" lists everything. Repos where the App isn't installed aren't listed.
- **The token never stays in the sandbox:** it's given only to the clone and push commands, never to `.git/config` or the remote URL, so the agent (which has a shell) never sees it. It's also kept out of logs and events.
- **The runner does the git work** (branch, commit, push) in the sandbox; **the worker opens the PR** through the API and updates the database. The CLI and evals keep working without GitHub.
- **Tests use recorded GitHub responses**; the whole flow is checked by hand once on a private test repository.

Branches, each built in small batches (see Ways of working):

- [x] **1. `feat/github-app`**: `@codegenie/github`, used by the server and the worker.
  1. Package and token minting: `createGithubApp({ appId, privateKey })`; `repoToken` / `repoClient` (one repository, given permissions, cached until near expiry); `installationForRepo`; private key parsing.
  2. Bot identity (`<slug>[bot]` and its noreply email, for commits) and webhook signature verification (`X-Hub-Signature-256`).
  3. Docs: `github.md` with the App registration guide (permissions, events, callback and setup URLs), the token model and the settings each app needs.
- [x] **2. `feat/github-install`**: the server ([github.md](./github.md) §6).
  1. GitHub-only sign-in through the App's OAuth.
  2. Webhook endpoint: raw body, signature check, `webhook_deliveries` dedupe.
  3. Installation events (`installation`, `installation_repositories`: created, repositories added/removed, suspended, deleted) → `github_installations`.
  4. Install callback (setup URL): checks the user can access the installation, then records it.
  5. Repo listing API: the user's installations, their repositories, the install / adjust-access URL.
  6. Docs.
- [x] **3. `feat/private-clone`**: the worker ([github.md](./github.md) §7).
  1. A run's token: the project's installation → a read token for its repository.
  2. Clone with the token passed only to that command; the remote is the plain URL afterwards; the token is redacted from logs and events.
  3. `worker:enqueue` finds a repository's real installation through the App, so private repositories work from the script.
  4. Docs.
- [x] **4. `feat/delivery`** ([github.md](./github.md) §8)
  1. Runner deliver step: list the agent's changes (files, modes, blob hashes, deletions, parent, expected tree) and hand them to a callback; no changes → no branch. (Planned as a push from the sandbox; changed so no write token enters the sandbox after the agent ran.)
  2. Worker: commit through GitHub's API on `codegenie/<task>-<slug>` as the App (verified), open the PR (draft when checks failed or the run is incomplete; ready with a note where drafts aren't available) with the summary, check results and changed files; update the task (branch, PR number and URL, `pr_open`) and the run (`commit_sha`); `branch_created` / `git_push` / `pr_opened` events; `deliver_failed` on errors. The agent titles its change in `finish_task`. The run link in the PR comes with the web app's run page (Phase 4).
  3. Docs.
- [x] **5. `feat/pr-webhooks`** ([github.md](./github.md) §6)
  1. `pull_request` merged / closed / reopened → the task's status.
  2. Docs.

**Done when:** a run on a private test repository opens a correct PR; installing, uninstalling or suspending the App is reflected in the database.
**Needs:** a dev GitHub App (App id and private key before branch 1 is checked by hand; client id and secret, webhook secret and a smee.io channel or cloudflared tunnel before branch 2), and a private test repository with the App installed before branch 3.

### Phase 4 — API & UI
**Goal:** the full prompt → PR flow from the browser. *(U3, U4, U5, U6, U7, U9, U10)*

- [ ] API: `POST /projects`, `GET /projects`, `GET /projects/:id`, `POST /projects/:id/tasks`, `GET /tasks/:id`, `GET /runs/:id`, `GET /runs/:id/events` (SSE + replay), `POST /runs/:id/cancel`; OpenAPI updated.
- [ ] Authorization: users only access their own resources.
- [ ] Web: connect-GitHub flow, repo picker (JS/TS warning), project page (task list: status, PR, duration, cost), new-task form, live run view (stage, tool calls, summary, PR link, cancel), task page (conversation + runs).
- [ ] API base URL via env; `/api/*` rewrite in Next.js.
- [ ] Environment onboarding on the website *(U10)*: "Set up environment" on the project page; `EventChannel` (questions as `question_asked` / `question_answered` run events); question cards; config panel with versions and rollback; "needs attention" banner.
- [ ] Playwright smoke test (sign in → task → events → PR link) with a mocked model.

**Done when:** U3–U7, U9 and U10 pass their acceptance criteria locally.

### Phase 5 — MVP launch
**Goal:** live, protected, open for signup. *(U8 + non-functional requirements)*

- [ ] Follow-ups: `POST /tasks/:id/messages` → `trigger=follow_up` run on the same branch/PR. *(U8)*
- [ ] Quotas: 1 concurrent run/user, 10 runs/user/day, global daily spend cap with clear rejection message.
- [ ] Hardening: helmet + rate limiting applied, refuse default secrets in production, structured logs with run id.
- [ ] Production builds for the server and worker: a bundler (e.g. `tsup`) that resolves the `@/…` aliases and includes the workspace packages, which ship TypeScript source.
- [ ] Deploy: Vercel (web), Railway (api, worker, Postgres, Redis), prod GitHub App, custom domain, per-service secrets, migrations as release step.
- [ ] Re-run eval against production config.

**Done when:** requirements §6 success criteria are met — U1–U9 pass in production, eval targets hit, author using it for real work. **MVP complete.**
**Needs:** Vercel, Railway, domain, prod GitHub App.

### Phase 6+ — Post-MVP
PR review comment / `@codegenie` triggers · Jira intake, then Notion · plan approval · sandbox pause/resume for follow-ups · resume a lost run (restart its parked sandbox and skip setup; otherwise a fresh sandbox with its saved diff applied) · faster runs (setup snapshots, reused baselines: today setup and checks take most of a 6–10 minute DoDesk run, see [evals.md](./evals.md)) · live previews · BYO API key / billing · team projects · more languages.

## 3. Ways of working

- **Branches & PRs:** `main` is always deployable. One branch per change (`feat/…`, `fix/…`, `chore/…`), merged via PR with CI green.
- **Commits:** conventional style (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- **Small batches:** a branch is built as a series of small commits, each one meaningful change that is easy to review: e.g. types, then core logic with its tests, then wiring, then docs. Every commit leaves type-check, lint and tests passing. Splits follow meaning, not a size rule: a batch is usually a few hundred lines or less, but a change that only makes sense whole stays whole. Moves and refactors get their own commit, never mixed into a feature commit.
- **Batch flow:** the proposal for a branch lists its planned batches. Each batch is built, explained and reviewed, then committed, before the next one starts; review fixes go into the same batch. The PR description covers the whole branch.
- **Tracking:** each phase's checklist above is the backlog; tick items as PRs merge.
- **Docs:** design changes update the relevant file in `docs/knowledge/` in the same PR.
- **Definition of done (per item):** code + tests where meaningful + type-check/lint pass + docs updated if behavior or design changed.

## 4. Testing strategy

| Layer | What | Tool |
|---|---|---|
| Unit | tools, setup detection, limits, token minting, webhook verification | Vitest |
| Integration | agent tools against real `DockerSandbox`; API routes against a test Postgres | Vitest + docker-compose |
| End-to-end | sign in → task → live events → PR link | Playwright (mocked model) |
| Agent quality | eval set: PR mergeability, checks pass rate, time, cost | `pnpm eval` (real model, run manually/nightly, not on every PR) |

## 5. Accounts needed

| Phase | Account |
|---|---|
| 1 | LLM provider API key |
| 2 | Daytona |
| 3 | GitHub App (dev) + a test repo |
| 5 | Vercel, Railway, domain, GitHub App (prod) |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Agent unreliable on unfamiliar repos | Eval set from Phase 1; setup detection + `AGENTS.md`; iterate on tools/prompt against measured scores |
| LLM cost from open signup | Per-run and per-user limits, global spend cap, GitHub-only sign-in |
| Environment setup failures | Restrict MVP to JS/TS without external services; surface setup errors to the agent |
| Slow runs (setup dominates) | Measured: 6–10 min per DoDesk run, mostly installs and checks. Post-MVP: setup snapshots and reused baselines ([environment.md](./environment.md)); meanwhile `--no-baseline-checks` |
| Sandbox leaks (cost) | Destroy in `finally`, auto-stop, reaper |
| Scope creep | Requirements doc is the scope; anything else goes to Phase 6+ |
