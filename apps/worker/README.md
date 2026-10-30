# @hobai/worker

Takes work off the Redis queue and runs it in a sandbox: task runs (`run-task`) and project onboarding (`onboard-project`). Design: [docs/knowledge/architecture.md](../../docs/knowledge/architecture.md) §3 and §5.

```
server API ──────────► Redis queue "hobai-work" ──► consumer ──► handler ──► runner ──► sandbox (Docker, E2B or Daytona)
                                                                   │            │
                                     "run-cancel" ─────────────────┘            ├──► Postgres: runs, run_events, onboardings, onboarding_events, project_environments
                                                                                ├──► Redis: run:{id}, onboarding:{id}
                                                                                └──► GitHub API: commit, branch, pull request
```

A run that succeeds or ends incomplete with changes is delivered: one commit by the App on `hobai/<task>-<slug>` and a pull request, a draft when checks failed or the run is incomplete ([github.md](../../docs/knowledge/github.md) §8).

## Running it

Postgres and Redis come from `apps/server/docker-compose.yml` (`pnpm setup` starts them). Sandboxes come from Docker (`pnpm sandbox:build-image`), E2B (`SANDBOX_PROVIDER=e2b`, after `pnpm sandbox:build-template` once per account; production uses it) or Daytona (`SANDBOX_PROVIDER=daytona`, after `pnpm sandbox:build-snapshot` once per account).

```bash
cp apps/worker/.env.example apps/worker/.env   # pnpm setup does this; then set OPENAI_API_KEY
pnpm dev:worker
```

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | required | |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` | required | the GitHub App's, for clone tokens ([github.md](../../docs/knowledge/github.md) §5) |
| `AGENT_MODEL` | `openai:gpt-6-luna` | must be in the model catalog |
| `WORKER_CONCURRENCY` | `3` | items worked on at once, each in its own sandbox |
| `SANDBOX_PROVIDER` | `docker` | `docker` (local containers), `e2b` or `daytona` (cloud sandboxes) |
| `E2B_API_KEY` | required for `e2b` | |
| `DAYTONA_API_KEY` | required for `daytona` | |
| `DAYTONA_API_URL`, `DAYTONA_TARGET` | Daytona's defaults | endpoint and region |
| `SANDBOX_RETENTION_HOURS` | `4` | how long a lost run's stopped Daytona sandbox is kept |
| `REAPER_INTERVAL_MINUTES` | `5` | how often the reaper runs |
| `ONBOARDING_ANSWER_TIMEOUT_MINUTES` | `30` | how long setup waits for an answer to its question |
| `FRONTEND_URL` | optional | the web app's address, for the task link in the pull request |
| `DATABASE_URL` | built from `DB_*`, same defaults as the server | |
| `REDIS_URL` | `redis://localhost:6380` | |
| `LOG_LEVEL` | `info` | |
| `WORKER_HEALTH_PORT` | `4100` | `GET /health`, for the container's health check; never published |

**Logs:** each piece of work logs `Work started`, its outcome (`Run finished` with status, steps and cost, or `Onboarding finished` with status and version) and `Work finished` with its duration; failures log `Work failed`.

**Reaper:** every `REAPER_INTERVAL_MINUTES` and at startup, one worker runs a `reap` item. It fails runs whose worker is gone (`running` with no active queue item: `worker_lost`) or that never left the queue (`queued` over 15 minutes, item gone: `lost_in_queue`). For a `worker_lost` run it first saves the diff from its sandbox and parks the sandbox. Logs: `Reaped` (with the count), `Failed a lost run`, `Kept a lost run's work`.

**Stopping:** Ctrl-C or SIGTERM stops taking new work and waits for the work in progress (a run or a setup stops itself by 45 minutes). Ctrl-C again, a second or more later, exits at once; anything unfinished is left for the reaper. Repeated SIGTERMs are ignored, so a deploy never cuts runs short ([architecture.md](../../docs/knowledge/architecture.md) §10). `pnpm dev:worker` reloads when a file it uses changes (the worker or the packages it imports, like the runner and the agent), the same as the server. A reload stops the worker the same way, but force-stops it after 5 seconds, so a run in progress at that moment is cut off and left for the reaper.

**Production:** `pnpm build:worker` bundles it into `dist/` (tsup); the image is `docker build -f apps/worker/Dockerfile .` from the repository root ([architecture.md](../../docs/knowledge/architecture.md) §10). `pnpm start` from the repository doesn't work: the bundle needs our packages' npm packages hoisted, which only the image does.

## Giving it work

Only the server queues work ([api.md](../../docs/knowledge/api.md)). Signed in, with `pnpm dev:server` and `pnpm dev:worker` running:

| Step | Request |
|---|---|
| Add a repository as a project | `POST /api/projects` `{ installationId, repoId }` |
| Set up its environment, once | `POST /api/projects/:id/onboarding` |
| Start a task | `POST /api/projects/:id/tasks` `{ prompt }` |
| Cancel a run | `POST /api/runs/:id/cancel` (queued: cancelled; running: stopped) |

The web app does each of these (add a repository, environment setup, New task, Cancel on the task page). You can also send them from the API docs at http://localhost:3001/api/docs, which use your session cookie.

Watching a run:

```bash
docker exec -it hobai-redis redis-cli psubscribe 'run:*' 'project:*'     # live events
docker exec -it hobai-postgres psql -U hobai_user -d hobai_db \
  -c "select id, status, stage, error_code, commit_sha, cost_usd from runs order by queued_at desc limit 5"
```

## Tests

`pnpm --filter @hobai/worker test`. Tests that need Postgres, Redis or Docker are skipped when those aren't running, and required in CI:

- `consumer.integration.test.ts`: the consumer on Redis with fake handlers (dispatch, cancellation, failures, closing).
- `handlers/*.integration.test.ts`: each handler on Postgres with a fake sandbox and a scripted model.
- `worker.integration.test.ts`: end to end, onboarding and a run through the real consumer, handlers, Docker, Postgres and Redis.

Redis tests use a key prefix of their own (`testRedisOrSkip`), so they never touch the dev queue.

## Layout

```
src/
├── index.ts          the process: config, logger, startWorker, shutdown
├── start-worker.ts   startWorker: connections, consumer, reaper (the @hobai/worker export, used by the e2e)
├── config.ts         apps/worker/.env, validated
├── consumer.ts       BullMQ worker: work kind → handler, cancel messages, close()
├── handlers/         run-task, onboard-project
├── delivery/         commit, branch name, pull request
├── github/           repo-scoped tokens
├── onboardings/      onboarding record, its events, routing answers
├── reaper/           lost runs, keeping their work, the schedule
├── runs/             run record: the runs row from queued to its final status
├── events/           event sink: run_events (numbered) + run:{id}
├── lib/              logger, serial queue
└── testing/          testRedisOrSkip, fakeGithubApp
```
