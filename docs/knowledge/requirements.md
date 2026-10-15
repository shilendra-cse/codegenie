# MVP Requirements

> Status: **Accepted** · Last updated: 2026-10-13 · Related: [architecture.md](./architecture.md), [database.md](./database.md)

## 1. Product

CodeGenie is an open-signup web platform where a developer connects their GitHub repositories, describes a coding task, and an autonomous agent completes it in an isolated cloud sandbox and delivers a pull request.

**Problem:** mid-sized, well-defined coding tasks (a feature, a bug fix, a refactor) take hours of a developer's attention even when the "what" is clear. CodeGenie turns a clear description into a reviewable PR without the developer doing the work.

**Context:** personal project, built and dog-fooded by the author first; signup is open to anyone.

## 2. Target user

A developer working on **JavaScript/TypeScript** repositories hosted on **GitHub**, who can describe what they want and will review the resulting PR.

## 3. Scope of work the agent must handle

**In scope — "mid-sized task on a moderately complex repo":**
- Tasks a developer would finish in roughly 1–4 hours: add a feature or endpoint, fix a bug, write tests, refactor a module, update a dependency and fix the fallout.
- Typically touches ~1–15 files.
- Repos: JS/TS, single package or simple monorepo (npm, pnpm, yarn or bun workspaces), up to roughly 100k lines of code.
- Install, lint, type-check and tests runnable inside the sandbox **without external services** (no required databases, cloud credentials or private registries).

**Out of scope for MVP:**
- Languages other than JS/TS (architecture allows adding them later).
- Large or highly complex codebases, polyglot monorepos, tasks spanning multiple repos.
- Tasks needing running external services, secrets or manual setup to verify.
- Vague open-ended work ("improve the app") — the agent may attempt it but quality is not a target.

## 4. User stories (MVP)

### Account & GitHub
| ID | Story | Acceptance criteria |
|---|---|---|
| U1 | As a visitor, I sign up / sign in with GitHub. | One-click GitHub sign-in creates an account; session persists across reloads; sign-out works. |
| U2 | As a user, I grant CodeGenie access to specific repos. | Install the GitHub App choosing all or selected repos; return to CodeGenie with installation recorded; can change selection later on GitHub and CodeGenie reflects it. |
| U3 | As a user, I connect a repo as a project. | Repo picker lists only repos the installation can access; choosing one creates a project; JS/TS check warns if the repo doesn't look like JS/TS. |

### Tasks
| ID | Story | Acceptance criteria |
|---|---|---|
| U4 | As a user, I describe a task on a project and start it. | Free-text prompt (+ optional base branch, default = repo default branch); task appears immediately with status `queued`. |
| U5 | As a user, I watch the agent work live. | Job view shows stage, tool calls (files read/edited, commands run), streamed reasoning summary; refreshing mid-job resumes without losing history. |
| U6 | As a user, I get a PR when the agent finishes. | PR on branch `codegenie/…` with title, summary of changes and lint/type-check/test results; **draft** if checks fail, **ready** if they pass; link shown in the UI. If no changes were needed, no PR and the agent explains why. |
| U7 | As a user, I can cancel a running task. | Cancel stops the agent within ~10 s, sandbox is destroyed, status `cancelled`, no PR pushed. |
| U8 | As a user, I send a follow-up on a task. | Message starts a new job on the same branch; changes are pushed to the same PR. |
| U9 | As a user, I see my history. | Project page lists tasks with status, PR link, duration and cost; task page shows conversation and all jobs. |

### Post-MVP (not required for MVP)
PR review comments / `@codegenie` mentions triggering jobs · Jira and Notion intake · plan approval before editing · team/org project sharing · live app previews · BYO API key · billing.

## 5. Non-functional requirements

### Limits (defaults, configurable by env)
| Limit | Default |
|---|---|
| Max wall time per job | 30 min |
| Max agent steps per job | 150 |
| Max LLM cost per job | $2 |
| Concurrent running jobs per user | 1 |
| Jobs per user per day | 10 (open-signup protection) |
| Global concurrent jobs | set by worker capacity (start: 3) |

On hitting a per-job limit the agent stops gracefully and delivers a draft PR marked incomplete.

### Security
- User code runs **only** inside Daytona sandboxes, never on our servers.
- Sandboxes receive only a repo-scoped GitHub installation token (~1 h TTL); no LLM keys, DB or Redis credentials.
- The agent never pushes to the default branch or force-pushes.
- GitHub webhooks are signature-verified; production refuses to start with default secrets.
- Users can only see and act on their own projects, tasks and jobs.

### Abuse & cost protection (open signup)
- GitHub-only sign-in for MVP (email/password and Google disabled) — raises the bar for throwaway accounts and is required for the GitHub App anyway.
- Per-user daily job quota and concurrency limit (above).
- Global daily spend cap; when reached, new tasks are rejected with a clear message.
- Sandboxes always destroyed at job end; auto-stop as backstop.

### Reliability
- A job never stays `running` forever: stalled jobs are failed and their sandboxes deleted by the reaper.
- Every job ends in exactly one terminal state (`succeeded`, `failed`, `cancelled`) with a reason on failure.
- No work is silently lost: if push fails, the error is shown.

### Performance
- Task creation responds in < 500 ms.
- First live event visible in the UI within ~10 s of starting a task.
- Sandbox ready (created, cloned, deps installed) within ~2 min for a typical repo.

### Observability
- Per job: duration, steps, tokens, cost, model, outcome — stored and visible.
- Structured logs with job id across server and worker.

## 6. Success criteria (MVP is "done" when)

1. All MVP user stories U1–U9 pass their acceptance criteria in production.
2. On the **eval set** (≥ 10 mid-sized tasks across ≥ 3 real JS/TS repos, including CodeGenie itself):
   - ≥ 60% produce a PR that is mergeable as-is or with light edits.
   - ≥ 80% end with lint, type-check and tests passing.
3. Median job: ≤ 15 min and ≤ $1.
4. The author uses CodeGenie for real tasks on their own projects.

## 7. Product decisions

| Decision | Choice | Rationale |
|---|---|---|
| Model selection | **Platform-controlled for MVP.** Users don't choose a model; the platform picks one per role (agent loop, utility calls) based on eval results and can change it at any time. Each job records the model it ran on. | The platform pays for usage, so cost must stay predictable; quality stays consistent and measurable; no "which model were you on?" support burden. |
| Future model choice | Introduced together with whoever pays: **tiers** (fast / balanced / best, mapped server-side) with paid plans, and **free choice from the model catalog** with bring-your-own API key. | User choice is low-risk once users carry the cost. The agent already takes the model as a parameter, so no rework is needed. |

## 8. Open questions

- **Who pays for LLM usage at scale?** MVP absorbs it within the quotas above; BYO API key or paid plans are post-MVP.
- **Waitlist vs instant access?** Default: instant access with quotas; switch to a waitlist if costs spike.
