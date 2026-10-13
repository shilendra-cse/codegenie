# Database Design

> Status: **Accepted** (MVP) · Last updated: 2026-10-13 · Engine: PostgreSQL · ORM: Drizzle

See [architecture.md](./architecture.md) for how these tables are used by the server and worker.

---

## 1. Core concept: Task vs Job

- **Task** — a unit of work. Owns the conversation, the branch and the PR. ("Add dark mode.")
- **Job** — one agent execution against a task. The initial run, a follow-up message and a PR review-comment response are all separate jobs on the **same task**: same branch, same PR.

This keeps follow-ups simple: a new job finds its branch and PR on its task, with no job-to-job chains.

---

## 2. Entity relationships

```
user ─┬─< session                       (Better Auth)
      ├─< account                       (Better Auth)
      ├─< github_installations          (installed_by)
      └─< projects >── github_installations
              │
              └─< tasks ─┬─< messages >──┐ (job_id nullable)
                         └─< jobs ───────┘
                               └─< job_events

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
| `setup_config` | jsonb null | cached detected commands `{ install, test, lint, build }` |
| `archived_at` | timestamptz null | soft delete |
| `created_at`, `updated_at` | timestamptz | |

Constraints: **unique (`user_id`, `repo_github_id`)**. Index: (`user_id`, `created_at`).

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
| `branch_name` | text null | set on first job |
| `pr_number` | integer null | set on delivery |
| `pr_url` | text null | |
| `status` | enum `task_status` (`open`, `pr_open`, `merged`, `closed`) | PR states updated by webhooks |
| `created_at`, `updated_at` | timestamptz | |

Index: (`project_id`, `created_at`).

### `jobs`
One agent execution.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | also used as the BullMQ job id |
| `task_id` | uuid FK → `tasks.id` | cascade |
| `trigger` | enum `job_trigger` (`initial`, `follow_up`, `pr_comment`, `retry`) | |
| `status` | enum `job_status` (`queued`, `running`, `succeeded`, `failed`, `cancelled`) | |
| `stage` | enum `job_stage` (`prepare`, `checkout`, `setup`, `agent`, `verify`, `deliver`) null | current pipeline stage, for UI |
| `sandbox_id` | text null | Daytona id; used by the reaper |
| `model` | text | model that ran the job |
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
- **Partial unique** on (`task_id`) `WHERE status IN ('queued','running')` — at most one active job per task, so two workers can never push to the same branch.
- Partial on (`status`) `WHERE status = 'running'` — reaper scans.

### `messages`
The conversation thread on a task.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid FK → `tasks.id` | cascade |
| `job_id` | uuid FK → `jobs.id` null | job this message triggered or produced; set null on delete |
| `role` | enum `message_role` (`user`, `assistant`, `system`) | |
| `author_user_id` | text FK → `user.id` null | null for assistant / PR-comment authored messages |
| `content` | text | |
| `created_at` | timestamptz | |

Index: (`task_id`, `created_at`).

### `job_events`
Live stream source and audit log.

| Column | Type | Notes |
|---|---|---|
| `job_id` | uuid FK → `jobs.id` | cascade |
| `seq` | integer | 1, 2, 3… per job, assigned by the worker |
| `type` | text | `tool_start`, `pr_opened`, … (see `JobEvent` in `packages/shared`) |
| `payload` | jsonb, default `{}` | |
| `created_at` | timestamptz | |

Primary key: **(`job_id`, `seq`)**. A job has exactly one writer, so `seq` is gap-free and ordered; SSE resume is `WHERE job_id = $1 AND seq > $lastEventId`. `text_delta` events are streamed live but **not** persisted.

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
- **Deletion:** cascade `user → projects → tasks → jobs → job_events`; projects are archived (`archived_at`), not hard-deleted.
- **Naming:** snake_case tables/columns; one kebab-case schema file per table in `apps/server/src/db/schema/` (e.g. `job-events-schema.ts`), relations in `relations.ts`, all re-exported from `src/db/schema.ts`.
- **Shared types:** `packages/shared/src/types/api.ts` mirrors these tables for the API and web app; change both together.

## 5. Migrations

Nothing is deployed yet, so the existing `0000`/`0001` migrations are **replaced by one clean initial migration** generated from the new schema. Local databases must be reset (`pnpm --filter @codegenie/server docker:reset`, then `pnpm migrate`). From then on, migrations are additive and generated with `drizzle-kit generate`.

## 6. Post-MVP

- `integration_connections` — `user_id`, `provider` (`jira`, `notion`), encrypted tokens, external workspace id, for ticket intake.
- Team access to projects (org members) — projects are single-owner in the MVP; nothing in this schema blocks adding a membership table later.
