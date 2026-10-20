# CodeGenie

A web-based autonomous coding agent. Connect your GitHub repositories, describe a task, and CodeGenie completes it in an isolated cloud sandbox and opens a pull request.

> Status: in development, working towards the MVP. See [docs/knowledge/development-plan.md](docs/knowledge/development-plan.md).

## Repository layout

```
apps/
  web/        Next.js UI
  server/     Express API (auth, projects, tasks, live run events)
  worker/     Runs queued tasks and project onboarding
  cli/        Run a task from the terminal (pnpm agent:setup, pnpm agent:run)
  evals/      Eval tasks and the harness that grades the agent (pnpm eval)
packages/
  runner/     Runs a task end to end: sandbox, checkout, setup, agent, verify
  agent/      The AI agent: model, prompt, tools, loop
  sandbox/    Isolated environments (Docker)
  db/         Postgres schema, client and migrations, shared by server and worker
  terminal/   Terminal output shared by the CLI and evals (colors, layout, spinners)
  shared/     Types shared across apps and packages
docs/
  api/        OpenAPI spec
  knowledge/  Requirements, architecture, database and development plan
script/       Setup and migration scripts
```

## Prerequisites

- Node.js 24
- pnpm 10 (`corepack enable`)
- Docker (Postgres and Redis run in containers)

## Getting started

```bash
pnpm setup
```

This installs dependencies, creates `.env` files from the examples, starts Postgres and Redis, and runs database migrations. Then fill in the credentials it warns about:

- `apps/server/.env`: GitHub and Google OAuth client ids and secrets
- `apps/cli/.env`: `OPENAI_API_KEY` (and optionally `AGENT_MODEL`)
- `apps/worker/.env`: `OPENAI_API_KEY` (and optionally `AGENT_MODEL`, `WORKER_CONCURRENCY`)

Start each app in its own terminal:

```bash
pnpm dev:server   # API at http://localhost:3001
pnpm dev:web      # UI at http://localhost:3000
pnpm dev:worker   # runs queued work; see apps/worker/README.md
```

Run the agent on a repository:

```bash
pnpm sandbox:build-image   # once, and after sandbox image changes
pnpm agent:setup --repo ../my-project      # once per repository; saved in ~/.codegenie
pnpm agent:setup --repo ../my-project --show
pnpm agent:run --repo ../my-project --task "Add a /health endpoint with a test"
pnpm agent:run --help      # all options
pnpm eval                  # run the eval tasks (real model runs; costs money)
```

Sign in at http://localhost:3000/signin.

## Common commands

| Command | What it does |
|---|---|
| `pnpm migrate` | Apply database migrations |
| `pnpm --filter @codegenie/db generate` | Write a migration after a schema change (`packages/db/src/schema/`) |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm build` | Build all packages |

API docs are served at http://localhost:3001/api/docs while the server is running.

## Documentation

- [Requirements](docs/knowledge/requirements.md)
- [Architecture](docs/knowledge/architecture.md)
- [Database](docs/knowledge/database.md)
- [Development plan](docs/knowledge/development-plan.md)
- [Runner](docs/knowledge/runner.md), [Environment](docs/knowledge/environment.md), [Agent](docs/knowledge/agent.md), [Sandbox](docs/knowledge/sandbox.md), [Evals](docs/knowledge/evals.md)

## License

ISC
