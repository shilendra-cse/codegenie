# @codegenie/worker

Takes work off the Redis queue and runs it in a sandbox: task runs (`run-task`) and project onboarding (`onboard-project`). Design: [docs/knowledge/architecture.md](../../docs/knowledge/architecture.md) §3 and §5.

```
pnpm worker:enqueue / API ──► Redis queue "codegenie-work" ──► consumer ──► handler ──► runner ──► sandbox (Docker or Daytona)
                                                                   │            │
                                     "run-cancel" ─────────────────┘            ├──► Postgres: runs, run_events, project_environments
                                                                                └──► Redis: run:{id}, project:{id}:onboarding
```

## Running it

Postgres and Redis come from `apps/server/docker-compose.yml` (`pnpm setup` starts them). Sandboxes come from Docker (`pnpm sandbox:build-image`) or Daytona (`SANDBOX_PROVIDER=daytona`, after `pnpm sandbox:build-snapshot` once per account).

```bash
cp apps/worker/.env.example apps/worker/.env   # pnpm setup does this; then set OPENAI_API_KEY
pnpm dev:worker
```

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | required | |
| `AGENT_MODEL` | `openai:gpt-6-luna` | must be in the model catalog |
| `WORKER_CONCURRENCY` | `3` | items worked on at once, each in its own sandbox |
| `SANDBOX_PROVIDER` | `docker` | `docker` (local containers) or `daytona` (cloud sandboxes) |
| `DAYTONA_API_KEY` | required for `daytona` | |
| `DAYTONA_API_URL`, `DAYTONA_TARGET` | Daytona's defaults | endpoint and region |
| `DATABASE_URL` | built from `DB_*`, same defaults as the server | |
| `REDIS_URL` | `redis://localhost:6380` | |
| `LOG_LEVEL` | `info` | |

**Logs:** each piece of work logs `Work started`, its outcome (`Run finished` with status, steps and cost, or `Onboarding finished` with status and version) and `Work finished` with its duration; failures log `Work failed`.

**Stopping:** Ctrl-C stops taking new work and waits for the work in progress (a run can take up to 30 minutes). Ctrl-C again, a second or more later, exits at once; anything unfinished is left for the reaper. There's no watch mode, because a restart would kill the runs in progress.

## Giving it work

Until the API exists (Phase 4), work is queued by hand, for public GitHub repositories:

```bash
pnpm worker:enqueue onboard octocat/Hello-World          # once per repository
pnpm worker:enqueue run octocat/Hello-World "Add a CONTRIBUTING.md"
pnpm worker:enqueue cancel <runId>                        # queued: cancelled; running: stopped
```

Projects created this way belong to a dev user with a placeholder GitHub installation. This code lives in `src/dev/` and moves to the API in Phase 4.

Watching a run:

```bash
docker exec -it codegenie-redis redis-cli psubscribe 'run:*' 'project:*'     # live events
docker exec -it codegenie-postgres psql -U codegenie_user -d codegenie_db \
  -c "select id, status, stage, error_code, cost_usd from runs order by queued_at desc limit 5"
```

## Tests

`pnpm --filter @codegenie/worker test`. Tests that need Postgres, Redis or Docker are skipped when those aren't running, and required in CI:

- `consumer.integration.test.ts`: the consumer on Redis with fake handlers (dispatch, cancellation, failures, closing).
- `handlers/*.integration.test.ts`: each handler on Postgres with a fake sandbox and a scripted model.
- `worker.integration.test.ts`: end to end, onboarding and a run through the real consumer, handlers, Docker, Postgres and Redis.

Redis tests use a key prefix of their own (`testRedisOrSkip`), so they never touch the dev queue.

## Layout

```
src/
├── index.ts          the process: config, connections, consumer, shutdown
├── config.ts         apps/worker/.env, validated
├── consumer.ts       BullMQ worker: work kind → handler, cancel messages, close()
├── handlers/         run-task, onboard-project
├── runs/             run record: the runs row from queued to its final status
├── events/           event sink: run_events (numbered) + run:{id}
├── lib/              logger, serial queue
├── dev/              pnpm worker:enqueue (moves to the API in Phase 4)
└── testing/          testRedisOrSkip
```
