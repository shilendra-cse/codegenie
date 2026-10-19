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
- [x] Update `packages/shared` types (Task, Job, Message, JobEvent, enums) to match the schema.
- [x] Remove `WORKSPACES_ROOT` / `lib/workspaces.ts`.

**Done when:** CI is green on `main`; `pnpm setup` from scratch produces a migrated DB; `pnpm dev:*` runs.

### Phase 1 — Agent core (local)
**Goal:** the agent completes mid-sized JS/TS tasks against a local Docker sandbox.

- [x] `Sandbox` interface + `DockerSandbox` (`exec`, `readFile`, `writeFile`, `listFiles`, `destroy`).
- [x] Base image: git, ripgrep, fd, Node + corepack (npm/pnpm/yarn). bun deferred (see [sandbox.md](./sandbox.md) TODO).
- [x] Tools rebuilt on `Sandbox` in `packages/agent` ([agent.md](./agent.md)): `list_files`, `read_file`, `search`, `edit_file` (unique match), `write_file`, `bash`, `run_checks`, `finish_task`; output truncation.
- [x] Agent loop: native SDK tool messages, model catalog (platform-controlled), step/time/cost limits with forced wrap-up, stop only on `finish_task`, `AbortSignal` cancellation, cache-friendly context compaction ([agent.md](./agent.md)).
- [x] Environment setup in `packages/runner` (setup stage): pluggable ecosystem detection (Node), package manager, frozen-then-fallback install, lint/typecheck/test/build checks; result passed to the agent's prompt and `run_checks`; `AGENTS.md` read into the prompt ([runner.md](./runner.md)). `.codegenie.yml` deferred.
- [x] Dev harness: `pnpm agent:run --repo <path|url> --task "…"` (`apps/cli`) running the full job via the runner (`runJob`: sandbox, checkout, setup, baseline, agent, verify, diff); config in `apps/cli/.env`; `apps/agent` removed ([runner.md](./runner.md)).
- [x] **Environment onboarding** ([environment.md](./environment.md)): a per-repository environment config created once through a guided conversation and replayed by every job.
  - [x] **A.** Config type + schema; `apply` / `validate`; jobs replay the config (`--environment`, `--save-environment`); baseline check run + before/after comparison in verify (`--no-baseline-checks`); files written by the first check run are part of the baseline, and the diff is taken before verify; rules-only draft, auto-approved inside the job. Standalone setup comes with D.
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
**Goal:** a queued job runs the full pipeline in a Daytona sandbox, with events persisted and published.

- [ ] `apps/worker` with BullMQ; pipeline stages prepare → checkout → setup → agent → verify → finally (deliver comes in Phase 3).
- [ ] `emit()` → `job_events` (`seq`) + Redis `job:{id}`; `jobs.stage`/status/usage updates.
- [ ] `DaytonaSandbox`; `codegenie-base` snapshot build script; `SANDBOX_PROVIDER=docker|daytona`.
- [ ] Reaper: fail stalled jobs, delete orphaned sandboxes.
- [ ] Per-job limits enforced (30 min / 150 steps / $2).
- [ ] Environment storage in the database: migration for `project_environments` and `jobs.environment_id`, drop `projects.setup_config`; `DbEnvironmentStore`; jobs load the project's active config and record the version used ([database.md](./database.md)).

**Done when:** a script-enqueued job runs in Daytona, events appear in Redis and Postgres, and the sandbox is always deleted — including on failure and kill.
**Needs:** Daytona account.

### Phase 3 — GitHub App & delivery
**Goal:** real PRs on real repos using only installation tokens. *(U1, U2, U6 backend)*

- [ ] Register dev GitHub App (contents, pull requests, metadata; webhooks: installation, installation_repositories, pull_request).
- [ ] Better Auth: GitHub-only sign-in (disable email/password and Google).
- [ ] Install callback, `github_installations`, webhook endpoint with signature check + `webhook_deliveries` dedupe.
- [ ] App JWT → installation token minting; replace OAuth-token GitHub service.
- [ ] Repo listing from installations.
- [ ] Deliver stage: commit as `codegenie[bot]`, push, open draft/ready PR with summary + checks; no-diff path; `pull_request` webhook updates `tasks.status`.

**Done when:** a job on a test repo opens a correct PR; uninstalling/suspending the App is reflected in the DB.
**Needs:** GitHub App (dev), smee.io or cloudflared tunnel.

### Phase 4 — API & UI
**Goal:** the full prompt → PR flow from the browser. *(U3, U4, U5, U6, U7, U9, U10)*

- [ ] API: `POST /projects`, `GET /projects`, `GET /projects/:id`, `POST /projects/:id/tasks`, `GET /tasks/:id`, `GET /jobs/:id`, `GET /jobs/:id/events` (SSE + replay), `POST /jobs/:id/cancel`; OpenAPI updated.
- [ ] Authorization: users only access their own resources.
- [ ] Web: connect-GitHub flow, repo picker (JS/TS warning), project page (task list: status, PR, duration, cost), new-task form, live job view (stage, tool calls, summary, PR link, cancel), task page (conversation + jobs).
- [ ] API base URL via env; `/api/*` rewrite in Next.js.
- [ ] Environment onboarding on the website *(U10)*: "Set up environment" on the project page; `EventChannel` (questions as `question_asked` / `question_answered` job events); question cards; config panel with versions and rollback; "needs attention" banner.
- [ ] Playwright smoke test (sign in → task → events → PR link) with a mocked model.

**Done when:** U3–U7, U9 and U10 pass their acceptance criteria locally.

### Phase 5 — MVP launch
**Goal:** live, protected, open for signup. *(U8 + non-functional requirements)*

- [ ] Follow-ups: `POST /tasks/:id/messages` → `trigger=follow_up` job on the same branch/PR. *(U8)*
- [ ] Quotas: 1 concurrent job/user, 10 jobs/user/day, global daily spend cap with clear rejection message.
- [ ] Hardening: helmet + rate limiting applied, refuse default secrets in production, structured logs with job id.
- [ ] Deploy: Vercel (web), Railway (api, worker, Postgres, Redis), prod GitHub App, custom domain, per-service secrets, migrations as release step.
- [ ] Re-run eval against production config.

**Done when:** requirements §6 success criteria are met — U1–U9 pass in production, eval targets hit, author using it for real work. **MVP complete.**
**Needs:** Vercel, Railway, domain, prod GitHub App.

### Phase 6+ — Post-MVP
PR review comment / `@codegenie` triggers · Jira intake, then Notion · plan approval · sandbox pause/resume for follow-ups · faster jobs (setup snapshots, reused baselines: today setup and checks take most of a 6–10 minute DoDesk job, see [evals.md](./evals.md)) · live previews · BYO API key / billing · team projects · more languages.

## 3. Ways of working

- **Branches & PRs:** `main` is always deployable. One branch per change (`feat/…`, `fix/…`, `chore/…`), merged via PR with CI green.
- **Commits:** conventional style (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
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
| LLM cost from open signup | Per-job and per-user limits, global spend cap, GitHub-only sign-in |
| Environment setup failures | Restrict MVP to JS/TS without external services; surface setup errors to the agent |
| Slow jobs (setup dominates) | Measured: 6–10 min per DoDesk job, mostly installs and checks. Post-MVP: setup snapshots and reused baselines ([environment.md](./environment.md)); meanwhile `--no-baseline-checks` |
| Sandbox leaks (cost) | Destroy in `finally`, auto-stop, reaper |
| Scope creep | Requirements doc is the scope; anything else goes to Phase 6+ |
