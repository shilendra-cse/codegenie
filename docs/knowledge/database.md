# Database Design

> Status: **Accepted** (MVP) · Last updated: 2026-10-17 · Engine: PostgreSQL · ORM: Drizzle

See [architecture.md](./architecture.md) for how these tables are used by the server and worker.

---

## 1. Core concept: Task vs Run

- **Task** — a unit of work. Owns the conversation, the branch and the PR. ("Add dark mode.")
- **Run** — one agent execution against a task. The initial run, a follow-up message and a PR review-comment response are all separate runs on the **same task**: same branch, same PR.

This keeps follow-ups simple: a new run finds its branch and PR on its task, with no run-to-run chains.

---

## 2. Entity relationships

```
user ─┬─< session                       (Better Auth)
      ├─< account                       (Better Auth)
      ├─< github_installations          (installed_by)
      └─< projects >── github_installations
              │
              ├─< project_environments            (environment config versions)
              │         ▲
              │         └─────────────┐  runs.environment_id (version a run used)
              └─< tasks ─┬─< messages │  (messages.run_id nullable)
                         └─< runs ────┘
                               └─< run_events

webhook_deliveries                      (standalone, idempotency)
```

---

## 3. Tables

### Auth (managed by Better Auth)
`user`, `session`, `account`, `verification` — unchanged; keep Better Auth's text ids and shape. `account` holds the GitHub **login** OAuth token only; repository access goes through `github_installations`.

### `github_installations`
One row per GitHub App installation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `installation_id` | bigint, **unique** | GitHub's installation id |
| `account_login` | text | user or org login |
| `account_type` | enum `installation_account_type` (`user`, `organization`) | |
| `installed_by_user_id` | text FK → `user.id` | cascade |
| `suspended_at` | timestamptz null | set via `installation` webhook |
| `created_at`, `updated_at` | timestamptz | |

### `projects`
A repository connected by a user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text FK → `user.id` | owner; cascade |
| `installation_id` | uuid FK → `github_installations.id` | |
| `repo_github_id` | bigint | stable across renames |
| `repo_owner` | text | |
| `repo_name` | text | |
| `default_branch` | text | |
| `archived_at` | timestamptz null | soft delete |
| `created_at`, `updated_at` | timestamptz | |

Constraints: **unique (`user_id`, `repo_github_id`)**. Index: (`user_id`, `created_at`).

How to install and check the repository lives in `project_environments` (versioned), not on the project.

### `project_environments`
A project's environment config: how to install the repository and which checks to run ([environment.md](./environment.md)). Created by onboarding; every run replays the active version.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects.id` | cascade |
| `version` | integer | 1, 2, 3… per project |
| `config` | jsonb | the `EnvironmentConfig` (steps, checks, meta) |
| `source` | enum `environment_source` (`detected`, `ai`, `user`, `mixed`) | how this version was created |
| `status` | enum `environment_status` (`active`, `superseded`) | |
| `health` | enum `environment_health` (`ok`, `needs_attention`) | set by runs when a setup step fails or an uncovered project folder appears |
| `health_reasons` | jsonb (string list), default `[]` | why it needs attention, e.g. `admin/ has its own package.json but isn't covered by the environment.` |
| `health_updated_at` | timestamptz null | when health was last set |
| `verified_commit` | text null | commit onboarding verified the config on (from `config.meta.commit`) |
| `created_by_user_id` | text FK → `user.id` null | null when created automatically |
| `created_at` | timestamptz | |

Constraints and indexes:
- **unique (`project_id`, `version`)**
- **Partial unique** on (`project_id`) `WHERE status = 'active'`: at most one active config per project.
- (`project_id`, `created_at`).

Lifecycle: onboarding (or a user edit) inserts version N+1 as `active` and marks the previous one `superseded` in the same transaction; rollback reactivates an older version (Phase 4).

Code: `DbEnvironmentStore` in `packages/db` (`load`, `list`, `save`, `markHealth`, keyed by project id; the same `EnvironmentStore` interface as the CLI's file store). `save` locks the project row, so concurrent saves for one project get versions 1, 2, 3 in turn.

### `tasks`
A unit of work on a project.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects.id` | cascade |
| `created_by_user_id` | text FK → `user.id` | |
| `title` | text | derived from prompt or ticket |
| `source` | enum `task_source` (`prompt`, `jira`, `notion`) | |
| `source_ref` | text null | e.g. Jira key `ABC-123` |
| `source_url` | text null | |
| `base_branch` | text | |
| `branch_name` | text null | set on first run |
| `pr_number` | integer null | set on delivery |
| `pr_url` | text null | |
| `status` | enum `task_status` (`open`, `pr_open`, `merged`, `closed`) | PR states updated by webhooks |
| `created_at`, `updated_at` | timestamptz | |

Index: (`project_id`, `created_at`).

### `runs`
One agent execution.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | also used as the BullMQ job id |
| `task_id` | uuid FK → `tasks.id` | cascade |
| `trigger` | enum `run_trigger` (`initial`, `follow_up`, `pr_comment`, `retry`) | |
| `status` | enum `run_status` (`queued`, `running`, `succeeded`, `incomplete`, `failed`, `cancelled`) | |
| `stage` | enum `run_stage` (`prepare`, `checkout`, `setup`, `agent`, `verify`, `deliver`) null | current pipeline stage, for UI |
| `sandbox_id` | text null | Daytona id; used by the reaper |
| `environment_id` | uuid FK → `project_environments.id` null | the environment config version this run replayed; set null on delete |
| `model` | text | model the run used |
| `commit_sha` | text null | |
| `checks_passed` | boolean null | lint + tests outcome |
| `summary` | text null | agent's final summary; PR body and follow-up context |
| `error_code` | text null | machine-readable |
| `error_message` | text null | |
| `input_tokens` | integer, default 0 | |
| `output_tokens` | integer, default 0 | |
| `steps` | integer, default 0 | |
| `cost_usd` | numeric(10,4), default 0 | |
| `queued_at` | timestamptz | |
| `started_at`, `finished_at` | timestamptz null | |

Indexes:
- (`task_id`, `queued_at`)
- **Partial unique** on (`task_id`) `WHERE status IN ('queued','running')` — at most one active run per task, so two workers can never push to the same branch.
- Partial on (`status`) `WHERE status = 'running'` — reaper scans.

### `messages`
The conversation thread on a task.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid FK → `tasks.id` | cascade |
| `run_id` | uuid FK → `runs.id` null | run this message triggered or produced; set null on delete |
| `role` | enum `message_role` (`user`, `assistant`, `system`) | |
| `author_user_id` | text FK → `user.id` null | null for assistant / PR-comment authored messages |
| `content` | text | |
| `created_at` | timestamptz | |

Index: (`task_id`, `created_at`).

### `run_events`
Live stream source and audit log.

| Column | Type | Notes |
|---|---|---|
| `run_id` | uuid FK → `runs.id` | cascade |
| `seq` | integer | 1, 2, 3… per run, assigned by the worker |
| `type` | text | `tool_start`, `pr_opened`, … (see `RunEvent` in `packages/shared`) |
| `payload` | jsonb, default `{}` | |
| `created_at` | timestamptz | |

Primary key: **(`run_id`, `seq`)**. A run has exactly one writer, so `seq` is gap-free and ordered; SSE resume is `WHERE run_id = $1 AND seq > $lastEventId`. `text_delta` and `agent_step` events are streamed live but **not** persisted.

### `webhook_deliveries`
Idempotency for GitHub webhooks (GitHub retries deliveries).

| Column | Type | Notes |
|---|---|---|
| `delivery_id` | text PK | `X-GitHub-Delivery` header |
| `event` | text | |
| `received_at` | timestamptz | |

Insert first; on conflict, skip processing. Rows older than 30 days can be pruned.

---

## 4. Conventions

- **IDs:** `uuid` for our tables, defaulting to `gen_random_uuid()` in Postgres; Better Auth tables keep text ids, so FKs to `user` are `text`.
- **Time:** every timestamp in our tables is `timestamptz`. Better Auth tables keep the plain `timestamp` columns Better Auth generates.
- **Enums:** Postgres enums for statuses, mirrored as TS unions in `packages/shared`.
- **Deletion:** cascade `user → projects → tasks → runs → run_events` and `projects → project_environments`; projects are archived (`archived_at`), not hard-deleted.
- **Naming:** snake_case tables/columns; one kebab-case schema file per table in `packages/db/src/schema/` (e.g. `run-events-schema.ts`), relations in `relations.ts`, all re-exported from `schema/index.ts`.
- **Shared types:** `packages/shared/src/types/api.ts` mirrors these tables for the API and web app; change both together.

## 5. Migrations

Nothing is deployed yet, so the existing `0000`/`0001` migrations are **replaced by one clean initial migration** generated from the new schema. Local databases must be reset (`pnpm --filter @codegenie/server docker:reset`, then `pnpm migrate`). From then on, migrations are additive and generated with `drizzle-kit generate`.

The schema, client and migrations live in `packages/db`, shared by the server and the worker ([architecture.md](./architecture.md), [packages/db/README.md](../../packages/db/README.md)). After changing `packages/db/src/schema/`, write a migration with `pnpm --filter @codegenie/db generate`; apply migrations with `pnpm migrate`.

The rename to runs (`runs`, `run_events`, `run_id`, `run_*` enums) regenerated `0000_initial` the same way.

**Tests** that need Postgres use `testDatabaseOrSkip` from `@codegenie/db/testing`: a fresh, migrated database per run, created next to the development one (or on `TEST_DATABASE_URL`) and dropped afterwards; skipped without Postgres, required in CI (which runs a Postgres service).

## 6. Post-MVP

- `integration_connections` — `user_id`, `provider` (`jira`, `notion`), encrypted tokens, external workspace id, for ticket intake.
- Onboarding conversations on the website: modeled as a run of kind `environment_setup`, with questions and answers as `run_events` (`question_asked`, `question_answered`).
- Team access to projects (org members) — projects are single-owner in the MVP; nothing in this schema blocks adding a membership table later.
