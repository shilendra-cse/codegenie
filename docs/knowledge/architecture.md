# hobai Architecture

> Status: **Accepted** (MVP) · Last updated: 2026-10-25

hobai is a web-based autonomous coding agent. A user connects their GitHub repositories, assigns a task (a prompt for the MVP; Jira and Notion later), and the agent completes it inside an isolated cloud sandbox and delivers the result as a pull request.

---

## 1. Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Sandbox provider | **Daytona Cloud**, behind a `Sandbox` interface | Generous free tier, pay-as-you-go, self-hostable later. Interface keeps the vendor swappable; a `DockerSandbox` serves local dev. |
| D2 | Where the agent loop runs | **In our worker**, tools execute remotely in the sandbox | LLM keys, DB and Redis never enter the sandbox; run state survives sandbox failure; trivial event streaming. |
| D3 | GitHub access | **One GitHub App** for sign-in (its OAuth) and repo access (its installations); GitHub-only sign-in for the MVP | Per-repo consent, 1-hour tokens scoped to one repo and minimal permissions, bot identity on commits/PRs, webhooks; one registration and one identity. |
| D4 | Run execution | **BullMQ** on Redis, dedicated `apps/worker` process | Already have Redis; durable queue, retries, concurrency control, stalled-job detection. |
| D5 | Live updates | Worker → Redis pub/sub + `run_events` table → server **SSE** → browser | Replayable (refresh mid-run works), auditable, simple. |
| D6 | Delivery | Worker (not the agent) commits through GitHub's API and opens the PR. **Draft PR** if checks fail, ready PR if they pass. Never the default branch. | Model can't push half-done work; no write token ever enters the sandbox; commits show as verified. |
| D7 | Autonomy | Fire-and-forget to PR. Plan-approval step is a **post-MVP** per-task toggle. | Keep MVP flow minimal. |
| D8 | Sandbox lifetime | **One sandbox per run, deleted at the end.** Pause/resume for follow-ups is post-MVP. | Cost and simplicity. |
| D9 | LLM | Provider-agnostic via **Vercel AI SDK**; platform-controlled model from a **catalog** (prices, context window), selected by env (`AGENT_MODEL`); currently `gpt-6-luna` | Avoid lock-in; predictable cost; pick models by eval results. See [agent.md](./agent.md). |
| D10 | Hosting | **Vercel** (web) + **Railway** (api, worker, Postgres, Redis) | Managed, cheap at MVP scale, private networking between services. |
| D11 | Domains & auth cookies | Custom domain; web at `app.`, API proxied via Next.js rewrite (`/api/*` → api service) | Single browser origin: no third-party-cookie or CORS problems with Better Auth. |
| D12 | Task intake | All sources normalize to one `Task`; MVP = prompt only, then Jira, then Notion | Pipeline is source-agnostic; integrations are adapters. |
| D13 | Task vs Run | A **task** owns conversation, branch and PR; a **run** is one attempt at it | Follow-ups and PR-comment replies reuse the task's branch/PR without run chains. |
| D14 | Project ownership | Single-user projects for MVP | Team/org access can be added later without schema changes to existing tables. |

---

## 2. System overview

```
                        ┌──────────────────────── our cloud ────────────────────────┐
Browser ──HTTPS──► apps/web (Next.js, Vercel)                                      │
                        │  /api/* rewrite                                          │
                        ▼                                                          │
                   apps/server (Express, Railway) ── enqueue ──► Redis (BullMQ,    │
                        │   auth, projects, tasks,    ◄─subscribe─  pub/sub)       │
                        │   SSE, GitHub webhooks                      ▲   │        │
                        ▼                                    publish  │   │ consume│
                   Postgres (Railway) ◄──────────────────────────── apps/worker     │
                                                                   (Railway, no    │
                                                                    public port)   │
                        └──────────────────────────────────────────────┬───┬───────┘
                                                        Daytona SDK    │   │ GitHub App API
                                                                       ▼   ▼
                                                     Daytona sandbox ──git──► GitHub
                                                     (one per run)
                                                                       LLM API ◄── worker
```

### Monorepo layout

```
apps/
  web/        Next.js UI
  server/     Express API (auth, REST, SSE, webhooks) — never touches sandboxes
  worker/     BullMQ consumer: calls the runner for queued runs
  cli/        local dev harness: calls the runner, prints events
  evals/      eval tasks for the agent and the harness that runs them
  e2e/        the end-to-end test: the whole journey in Playwright, run on demand (web.md §19)
packages/
  runner/     runs a task end to end: checkout → setup → agent → verify → deliver (no AI logic)
  agent/      AI only: LLM loop, model catalog, prompt, sandbox-backed tools
  sandbox/    Sandbox interface + DockerSandbox (+ DaytonaSandbox)
  github/     GitHub App: repo-scoped installation tokens, bot identity, webhook signatures (github.md)
  db/         Postgres schema, client and migrations (Drizzle), shared by server and worker
  terminal/   terminal output for the CLI and evals
  shared/     types shared across apps and packages (API, events, setup), and the brand (@hobai/shared/brand)
docs/
  api/        OpenAPI spec
  knowledge/  architecture, design and feature docs
```

Dependencies point one way: `runner → agent, sandbox, shared`; `agent → sandbox, shared`; `sandbox → shared`; `db → shared`; `terminal → shared`. Apps: `server → db, github, shared`; `worker → runner, agent, sandbox, db, github, shared`; `cli → runner, agent, terminal, shared`; `evals → runner, agent, sandbox, terminal, shared`; `web → shared`. Apps never import from other apps, except `e2e`, which drives the worker in-process.

**The brand lives in one place.** `@hobai/shared/brand` exports the product name (`hobai`), the short name (`hobai`) and the domain. UI copy, error messages, prompts and the PR footer use the product name; the identifiers built from the short name (branch prefix, sandbox image, snapshot and label, `/tmp/hobai`, the CLI home and `HOBAI_HOME`, the queue, the localStorage prefix, test prefixes) build it rather than write it out. Files that can't import TypeScript write it out: package names, `docker-compose.yml`, `ci.yml`, `script/*.sh`, `.env.example`, the sandbox Dockerfile (including the bot git identity `hobai <bot@hobai.app>`) and the docs.

**`packages/db` rules.** The server and the worker both use the database directly (the server writes rows and enqueues; the worker updates runs and writes events), so the schema lives in one shared package instead of inside one app:
- **all data access lives here:** schema, client, migrations and every query (`src/queries/`, one folder per domain, mirroring `src/schema/`). Apps call query functions and never build queries; ESLint enforces it (`@hobai/db/eslint`). Queries hold no business rules: they report what happened, and the app decides what it means;
- migrations run from one place (the deploy step, `pnpm migrate`), never on app startup;
- the connection is created by each app (`createDb(url)` with its own config), never on import.
A schema change can mean redeploying both apps; that comes from sharing the database, not from the package. The old `apps/agent` REPL is replaced by `apps/cli`. Details: [runner.md](./runner.md), [agent.md](./agent.md), [sandbox.md](./sandbox.md).

---

## 3. Components

### apps/web
Pages: sign-in, connect GitHub (App install), repo picker, project view (tasks/runs history), new task, live run view (event timeline, tool calls, streamed summary, PR link). Talks only to `/api/*` (same origin via rewrite).

### apps/server
- Better Auth (GitHub sign-in through the App, sessions).
- GitHub App ([github.md](./github.md) §6): install callback, webhook receiver with signature verification and delivery dedupe (`installation`, `installation_repositories`, `pull_request` → task status; `pull_request_review_comment`, `issue_comment` later), repo picker API (installations and their repositories, through the user's token).
- REST: projects, environments (and restore), branches, onboarding, tasks, runs (diff, cancel), GitHub. Full list: [api.md](./api.md) §4.
- SSE, replay + live: `GET /api/runs/:id/events` and `GET /api/projects/:id/onboarding/events`.
- Task follow-ups (`POST /api/tasks/:id/messages`) are planned (Phase 5).
- Writes rows and enqueues; does no long-running work.

### apps/worker
Consumes the BullMQ queue `hobai-work` and runs the pipeline in §5. Details and commands: [apps/worker/README.md](../../apps/worker/README.md).

- **Work kinds:** `run-task { runId }` (one run of a task) and `onboard-project { onboardingId }` (one setup of a project's environment, recorded in `onboardings`; [environment.md](./environment.md) §3.5). A setup's events are stored in `onboarding_events` and published live on `onboarding:{id}`; a failed setup fails its queue item, and the reaper ends setups whose worker is gone, as it does for runs.
- **Concurrency:** `WORKER_CONCURRENCY` items at once per process (default 3), each in its own sandbox; more throughput means more processes.
- **Cancellation:** a queued run is marked `cancelled` in the database, and the worker skips it. A running one gets a `run-cancel` message carrying its id; every worker process hears it, and the one running it aborts the run's signal.
- **No retries:** an item whose worker died is failed when BullMQ detects it as stalled, never run again (the agent may already have pushed or spent money).
- **Reaper:** a `reap` work item, every 5 minutes (one BullMQ job scheduler shared by all workers) and at startup. It fails runs nothing will finish: `running` with no active queue item (`worker_lost`), or `queued` for over 15 minutes with the item gone (`lost_in_queue`), adding `error` + `done` events. For a `worker_lost` run it first saves the diff from its sandbox and parks the sandbox (Daytona: stopped, kept 4 h for a future resume; Docker: deleted).
- **Shutdown:** the first SIGINT/SIGTERM stops taking work and waits for the work in progress; a second one a second or more later exits at once and leaves the rest to the reaper.
- **Clone:** with a read token for the project's repository from the GitHub App, passed only to the clone command ([github.md](./github.md) §7).

### packages/agent
Details: **[agent.md](./agent.md)**.

`runAgent({ runId, task, ctx, model, limits, emit, signal })` → `AgentResult`. `ctx` carries the sandbox and check commands; `model` is a resolved catalog entry. Tools are thin wrappers over `Sandbox`; never touch the host filesystem.

### packages/sandbox
```ts
interface Sandbox {
  readonly id: string;
  exec(command: string, options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> }):
    Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean; truncated: boolean }>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string, options?: { maxDepth?: number }): Promise<FileEntry[]>;
  destroy(): Promise<void>;
}
```
Implementations: `DaytonaSandbox` (prod), `DockerSandbox` (dev/tests). Selected by `SANDBOX_PROVIDER=daytona|docker`.

Daytona sandboxes are created from the **`hobai-base` snapshot**, built from the same Dockerfile as the Docker image (`pnpm sandbox:build-snapshot`). Every sandbox is labelled `hobai=1` plus `kind` and `runId` / `projectId`; Daytona's are ephemeral, with a 2-hour TTL and auto-stop as safety nets. Details: [sandbox.md](./sandbox.md) §7.

---

## 4. Flows

### 4.1 Connect GitHub (one-time)
1. User signs in with GitHub OAuth (identity only).
2. "Connect repositories" → `github.com/apps/<app>/installations/new` → user selects repos.
3. Callback with `installation_id` → server stores `github_installations` row; `installation` webhook confirms.
4. Repo picker lists repos accessible to the user's installations. Choosing one creates a `project`.

For any repo access, the server/worker signs a JWT with the App private key and exchanges it for an **installation token** scoped to that repo (~1h TTL). No long-lived repo credentials are stored.

### 4.2 Create a task
```
POST /api/projects/:id/tasks { prompt, baseBranch? }
  authorize user owns project
  409 if the GitHub App is uninstalled or suspended on the project's account
  409 if the project has no environment, or its environment needs attention
  tx: insert task(source=prompt) + message(role=user) + run(trigger=initial, status=queued)
  queue.add("run-task", { runId }, { jobId: runId })     // idempotent
    queue down → run marked failed (queue_unavailable) → 503 QUEUE_UNAVAILABLE
  → 201 { task, run }
```
Client opens the SSE stream for `run.id`.

### 4.3 Live events
```
worker emit(e):   INSERT run_events  +  PUBLISH run:{runId}
server SSE:       SUBSCRIBE first → replay run_events after Last-Event-ID → forward live (dedupe by id)
                  heartbeat 15s; close on done/error
```
Events are keyed by (`run_id`, `seq`); `seq` is the SSE event id. High-frequency `text_delta` and `agent_step` events are published live only, never stored.

### 4.4 Follow-ups
- **UI follow-up message** (planned, Phase 5: `POST /api/tasks/:id/messages`) → new run on the same task with `trigger=follow_up`; checks out the task's branch, receives the previous run's summary + new instruction, pushes to the same PR.
- **PR review comment / `@hobai` mention** (webhook, deduped via `webhook_deliveries`) → new run on the task with `trigger=pr_comment`; context includes comment, file and line.
- **Jira (post-MVP)** → webhook on assignment/label → Task → run; PR link posted back to the ticket.

Every entry point reduces to **task → new run**.

---

## 5. Run pipeline (worker)

| Stage | Actions | Events |
|---|---|---|
| **Prepare** | load run/task/project; `status=running`; mint installation token; create Daytona sandbox; persist `sandboxId`. Alongside, on a task's first run, the model writes its short title ([agent.md](./agent.md) §10) | `sandbox_created`, `task_titled` |
| **Checkout** | shallow clone of the base branch into `/workspace` (later runs will check out `task.branch_name`) | |
| **Setup** | replay the project's environment config (setup steps), then run every check once as a baseline; the config is created once per repository by environment onboarding ([environment.md](./environment.md)) | `setup_started`, `setup_completed` |
| **Agent** | run agent loop (§6) | `tool_start`, `tool_end`, `text_delta`, `agent_step` |
| **Verify** | run lint + tests; on failure with budget left, feed failures back into the agent | `checks_completed` |
| **Deliver** | no diff → finish with explanation, no PR. Else the runner lists the changes and the worker commits them through GitHub's API as the App on `hobai/<title slug>-<taskId prefix>` and opens the PR (draft if checks failed or incomplete) with summary + checks + changed files ([github.md](./github.md) §8) | `branch_created`, `git_push`, `pr_opened` |
| **Finally** | persist summary & usage; `status=succeeded/failed/cancelled`; **always** destroy sandbox | `done` / `error` |

The clone token is passed to git through that command's environment rather than stored in `.git/config`; no write token enters the sandbox.

---

## 6. Agent loop

**Context:** system rules (stay in `/workspace`, don't touch `.git` internals, verify before finishing) + repo context (depth-limited tree, README excerpt, `AGENTS.md`, detected commands) + normalized task.

**Tools:**

| Tool | Behavior |
|---|---|
| `list_files(path, depth)` | tree, ignores `node_modules`, `.git`, build output |
| `read_file(path, startLine?, endLine?)` | line-numbered, size-capped |
| `search(pattern, glob?)` | ripgrep `file:line: text`, capped |
| `edit_file(path, old, new)` | `old` must match exactly once, else error with hint |
| `write_file(path, content)` | create / full rewrite |
| `bash(cmd, timeoutMs?)` | anything else, cwd `/workspace` |
| `run_checks()` | detected lint + test commands, condensed failures |
| `finish_task(title?, summary)` | ends loop; title becomes the commit subject and PR title, summary the PR body |

**Rules:**
- Loop ends only on `finish_task` or a limit — not when the model stops calling tools.
- Tool output truncated head+tail with an "N lines omitted" marker.
- At ~70% of the context window, older tool results are summarized; task, plan and recent turns kept.
- Limits per run: `maxSteps` (~150), `maxWallTime` (~30 min), `maxCostUsd`. On limit: force a summary, deliver as draft PR marked incomplete.
- Cancellation via `AbortSignal`, checked every step.
- Message history uses the SDK's native tool messages (`response.messages`), never synthetic user/assistant turns.

---

## 7. Data model

Full design: **[database.md](./database.md)**. Summary:

- **Task** = unit of work (conversation, branch, PR). **Run** = one agent execution on a task. Follow-ups and PR-comment responses are new runs on the same task.
- Tables: Better Auth (`user`, `session`, `account`, `verification`), `github_installations`, `webhook_deliveries`, `projects`, `project_environments`, `onboardings`, `onboarding_events`, `tasks`, `messages`, `runs`, `run_events`, `run_diffs`.
- A partial unique index allows at most one queued/running run per task.
- `run_events` keyed by (`run_id`, `seq`) for gap-free SSE replay.
- Migrations live in `packages/db/drizzle`.

Removed from server: `WORKSPACES_ROOT`, `lib/workspaces.ts`, OAuth-token GitHub service (replaced by App tokens), unused JWT/bcrypt config.

---

## 8. Failure handling

| Failure | Handling |
|---|---|
| Worker crash mid-run | The item is failed when BullMQ detects it as stalled (`maxStalledCount: 0`, never retried). Within 5 minutes (or at the next worker start) the reaper saves the run's diff, parks its sandbox and fails the run with `worker_lost`. Daytona deletes a parked sandbox after `SANDBOX_RETENTION_HOURS`. |
| Sandbox create fails | Retry with backoff (nothing has happened yet). |
| Dependency install fails | Continue; agent is told setup failed and may fix it. |
| LLM error / rate limit | Backoff retry inside loop; fail after N attempts. |
| User cancels | `POST /api/runs/:id/cancel`: a queued run is marked `cancelled` directly; a running one gets a `run-cancel` message → abort signal → sandbox destroyed → `cancelled`. |
| Delivery refused (branch exists, permissions, mismatch) | `deliver_failed` with the reason; the diff stays saved on the run. |

---

## 9. Security

- Untrusted code runs **only** in Daytona sandboxes; never on our servers.
- Sandbox receives only a repo-scoped, ~1h installation token, only for the run's duration.
- Secret placement:

| Secret | web | api | worker | sandbox |
|---|---|---|---|---|
| Better Auth secret, OAuth client creds | – | ✓ | – | – |
| GitHub App private key | – | ✓ | ✓ | – |
| GitHub webhook secret | – | ✓ | – | – |
| `DATABASE_URL`, `REDIS_URL` | – | ✓ | ✓ | – |
| Daytona API key | – | – | ✓ | – |
| LLM API key | – | – | ✓ | – |
| Installation token (repo-scoped, 1h) | – | – | – | ✓ |

- Webhook signatures verified; production refuses to boot with default secrets.
- Agent never pushes to the default branch; one active run per task (enforced by a DB index).
- Per-user limits on concurrent runs and daily spend, enforced at task creation, are planned (Phase 5).
- Full audit trail in `run_events`.

---

## 10. Deployment

| Component | Host | Notes |
|---|---|---|
| web | Vercel | `/api/*` rewrite to api service (SSE buffering disabled) |
| api | Railway service | public; migrations run as release step |
| worker | Railway service | private; scale via replicas / BullMQ concurrency |
| Postgres | Railway | managed, backups |
| Redis | Railway | real TCP Redis (BullMQ + pub/sub) |
| Sandboxes | Daytona Cloud | `hobai-base` snapshot built by script |
| GitHub App | GitHub | separate dev and prod Apps |

**Local dev:** `docker-compose` (Postgres, Redis) · `pnpm dev:web` / `dev:server` / `dev:worker` · `SANDBOX_PROVIDER=docker` (or `daytona` on free tier) · webhooks via smee.io or cloudflared tunnel.

---

## 11. Roadmap

| Phase | Scope | Outcome | Status |
|---|---|---|---|
| 0. Foundations | CI (lint, type-check, Vitest), cleanup, package skeletons, **new DB schema + clean initial migration**, shared types updated | Repo in final shape, schema in place | Done |
| 1. Agent core | `packages/sandbox` (interface + Docker), `packages/agent` with sandbox-backed tools, fixed history, configurable model, limits | Agent works locally against any repo | Done |
| 2. Worker + Daytona | `DaytonaSandbox`, base snapshot, `apps/worker`, BullMQ, events → Redis + `run_events` | Runs execute in the cloud | Done |
| 3. GitHub App | install flow, token minting, clone → commit → PR | Real PRs | Done |
| 4. API + UI | projects/tasks/runs/onboarding endpoints, SSE, the web app (repo picker, environment setup, new task, live run view, Inbox, project page), Playwright end-to-end test | Prompt → PR from the browser | Done |
| 5. MVP launch | follow-ups, quotas, hardening, production builds, deploy | **MVP: live, open for signup** | Next |
| 6+. Post-MVP | PR-comment / `@hobai` triggers, Jira then Notion, plan approval, sandbox pause/resume, live previews, code index, billing, orgs | | |
