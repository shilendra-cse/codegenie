# CodeGenie Architecture

> Status: **Accepted** (MVP) · Last updated: 2026-10-13

CodeGenie is a web-based autonomous coding agent. A user connects their GitHub repositories, assigns a task (a prompt for the MVP; Jira and Notion later), and the agent completes it inside an isolated cloud sandbox and delivers the result as a pull request.

---

## 1. Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Sandbox provider | **Daytona Cloud**, behind a `Sandbox` interface | Generous free tier, pay-as-you-go, self-hostable later. Interface keeps the vendor swappable; a `DockerSandbox` serves local dev. |
| D2 | Where the agent loop runs | **In our worker**, tools execute remotely in the sandbox | LLM keys, DB and Redis never enter the sandbox; run state survives sandbox failure; trivial event streaming. |
| D3 | GitHub access | **One GitHub App** for sign-in (its OAuth) and repo access (its installations); GitHub-only sign-in for the MVP | Per-repo consent, 1-hour tokens scoped to one repo and minimal permissions, bot identity on commits/PRs, webhooks; one registration and one identity. |
| D4 | Run execution | **BullMQ** on Redis, dedicated `apps/worker` process | Already have Redis; durable queue, retries, concurrency control, stalled-job detection. |
| D5 | Live updates | Worker → Redis pub/sub + `run_events` table → server **SSE** → browser | Replayable (refresh mid-run works), auditable, simple. |
| D6 | Delivery | Worker (not the agent) commits, pushes, opens PR. **Draft PR** if checks fail, ready PR if they pass. Never push to default branch. | Model can't push half-done work; consistent git hygiene. |
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

### Monorepo layout (target)

```
apps/
  web/        Next.js UI
  server/     Express API (auth, REST, SSE, webhooks) — never touches sandboxes
  worker/     BullMQ consumer: calls the runner for queued runs
  cli/        local dev harness: calls the runner, prints events
packages/
  runner/     runs a task end to end: checkout → setup → agent → verify → deliver (no AI logic)
  agent/      AI only: LLM loop, model catalog, prompt, sandbox-backed tools
  sandbox/    Sandbox interface + DockerSandbox (+ DaytonaSandbox)
  github/     GitHub App: repo-scoped installation tokens, bot identity, webhook signatures (github.md)
  db/         Postgres schema, client and migrations (Drizzle), shared by server and worker
  terminal/   terminal output for the CLI and evals
  shared/     types shared across apps and packages (API, events, setup)
docs/
  api/        OpenAPI spec
  knowledge/  architecture, design and feature docs
```

Dependencies point one way: `runner → agent, sandbox, shared`; `agent → sandbox, shared`; `db → shared`; apps → runner, db. Apps never import from other apps.

**`packages/db` rules.** The server and the worker both use the database directly (the server writes rows and enqueues; the worker updates runs and writes events), so the schema lives in one shared package instead of inside one app:
- **all data access lives here:** schema, client, migrations and every query (`src/queries/`, one folder per domain, mirroring `src/schema/`). Apps call query functions and never build queries; ESLint enforces it (`@codegenie/db/eslint`). Queries hold no business rules: they report what happened, and the app decides what it means;
- migrations run from one place (the deploy step, `pnpm migrate`), never on app startup;
- the connection is created by each app (`createDb(url)` with its own config), never on import.
A schema change can mean redeploying both apps; that comes from sharing the database, not from the package. The old `apps/agent` REPL is replaced by `apps/cli`. Details: [runner.md](./runner.md), [agent.md](./agent.md), [sandbox.md](./sandbox.md).

---

## 3. Components

### apps/web
Pages: sign-in, connect GitHub (App install), repo picker, project view (tasks/runs history), new task, live run view (event timeline, tool calls, streamed summary, PR link). Talks only to `/api/*` (same origin via rewrite).

### apps/server
- Better Auth (GitHub sign-in through the App, sessions).
- GitHub App ([github.md](./github.md) §6): install callback, webhook receiver with signature verification and delivery dedupe (`installation`, `installation_repositories` now; `pull_request`, `pull_request_review_comment`, `issue_comment` later), repo picker API (installations and their repositories, through the user's token).
- REST: projects, tasks, task messages (follow-ups), runs, cancel.
- `GET /api/runs/:id/events` — SSE replay + live.
- Writes rows and enqueues; does no long-running work.

### apps/worker
Consumes the BullMQ queue `codegenie-work` and runs the pipeline in §5. Details and commands: [apps/worker/README.md](../../apps/worker/README.md).

- **Work kinds:** `run-task { runId }` (one run of a task) and `onboard-project { projectId }` (sets a project's environment up with the recommended answers, until onboarding moves to the website in Phase 4). Onboarding progress is published live on `project:{id}:onboarding` and not stored; a failed onboarding fails its queue item.
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
  id: string;
  exec(cmd: string, opts?: { cwd?: string; timeoutMs?: number; env?: Record<string,string> }):
    Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<FileEntry[]>;
  previewUrl?(port: number): Promise<string>;   // post-MVP
  destroy(): Promise<void>;
}
```
Implementations: `DaytonaSandbox` (prod), `DockerSandbox` (dev/tests). Selected by `SANDBOX_PROVIDER=daytona|docker`.

Daytona sandboxes are created from the **`codegenie-base` snapshot**, built from the same Dockerfile as the Docker image (`pnpm sandbox:build-snapshot`). Every sandbox is labelled `codegenie=1` plus `kind` and `runId` / `projectId`; Daytona's are ephemeral, with a 2-hour TTL and auto-stop as safety nets. Details: [sandbox.md](./sandbox.md) §7.

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
POST /api/projects/:id/tasks { content, baseBranch? }
  authorize user owns project
  tx: insert task(source=prompt) + message(role=user) + run(trigger=initial, status=queued)
  queue.add("run-task", { runId }, { jobId: runId })     // idempotent
  → 201 { runId, messageId }
```
Client opens the SSE stream for `runId`.

### 4.3 Live events
```
worker emit(e):   INSERT run_events  +  PUBLISH run:{runId}
server SSE:       SUBSCRIBE first → replay run_events after Last-Event-ID → forward live (dedupe by id)
                  heartbeat 15s; close on done/error
```
Events are keyed by (`run_id`, `seq`); `seq` is the SSE event id. High-frequency `text_delta` events are published live but persisted batched (or only the final assistant message).

### 4.4 Follow-ups
- **UI follow-up message** (`POST /api/tasks/:id/messages`) → new run on the same task with `trigger=follow_up`; checks out the task's branch, receives the previous run's summary + new instruction, pushes to the same PR.
- **PR review comment / `@codegenie` mention** (webhook, deduped via `webhook_deliveries`) → new run on the task with `trigger=pr_comment`; context includes comment, file and line.
- **Jira (post-MVP)** → webhook on assignment/label → Task → run; PR link posted back to the ticket.

Every entry point reduces to **task → new run**.

---

## 5. Run pipeline (worker)

| Stage | Actions | Events |
|---|---|---|
| **Prepare** | load run/task/project; `status=running`; mint installation token; create Daytona sandbox; persist `sandboxId` | `sandbox_created` |
| **Checkout** | clone into `/workspace`; checkout base; create `codegenie/<taskId>-<slug>` on the first run (later runs check out `task.branch_name`) | `branch_created` |
| **Setup** | replay the project's environment config (setup steps), then run every check once as a baseline; the config is created once per repository by environment onboarding ([environment.md](./environment.md)) | `setup_started`, `setup_completed` |
| **Agent** | run agent loop (§6) | `tool_start`, `tool_end`, `text_delta`, `agent_step` |
| **Verify** | run lint + tests; on failure with budget left, feed failures back into the agent | `lint_completed`, `test_passed`/`test_failed` |
| **Deliver** | no diff → finish with explanation, no PR. Else commit as `codegenie[bot]`, push, open PR (draft if checks failed) with summary + checks + run link | `git_push`, `pr_opened` |
| **Finally** | persist summary & usage; `status=succeeded/failed/cancelled`; **always** destroy sandbox | `done` / `error` |

The token is passed to git via a one-off credential env at push/clone time rather than stored in `.git/config`.

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
| `finish_task(summary)` | ends loop; summary becomes PR body |

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
- Tables: Better Auth (`user`, `session`, `account`, `verification`), `github_installations`, `projects`, `tasks`, `runs`, `messages`, `run_events`, `webhook_deliveries`.
- A partial unique index allows at most one queued/running run per task.
- `run_events` keyed by (`run_id`, `seq`) for gap-free SSE replay.
- Existing migrations are replaced by one clean initial migration.

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
| Push rejected / branch protection | `error` event with reason; diff saved as an artifact. |

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
- Per-user limits on concurrent runs and daily spend, enforced at task creation.
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
| Sandboxes | Daytona Cloud | `codegenie-base` snapshot built by script |
| GitHub App | GitHub | separate dev and prod Apps |

**Local dev:** `docker-compose` (Postgres, Redis) · `pnpm dev:web` / `dev:server` / `dev:worker` · `SANDBOX_PROVIDER=docker` (or `daytona` on free tier) · webhooks via smee.io or cloudflared tunnel.

---

## 11. Roadmap

| Phase | Scope | Outcome |
|---|---|---|
| 0. Foundations | CI (lint, type-check, Vitest), cleanup, package skeletons, **new DB schema + clean initial migration**, shared types updated | Repo in final shape, schema in place |
| 1. Agent core | `packages/sandbox` (interface + Docker), `packages/agent` with sandbox-backed tools, fixed history, configurable model, limits | Agent works locally against any repo |
| 2. Worker + Daytona | `DaytonaSandbox`, base snapshot, `apps/worker`, BullMQ, events → Redis + `run_events` | Runs execute in the cloud |
| 3. GitHub App | install flow, token minting, clone → push → PR | Real PRs |
| 4. API + UI | tasks/runs endpoints, SSE, repo picker, `/build`, live run view | **MVP: prompt → PR** |
| 5. Iteration | follow-ups, PR-comment webhooks, cancellation | Collaborative loop |
| 6. Integrations | Jira, then Notion | Ticket → PR |
| Later | plan approval, sandbox pause/resume, live previews, code index, billing, orgs | |
