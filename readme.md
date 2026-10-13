# CodeGenie

A web-based autonomous coding agent. Connect your GitHub repositories, describe a task, and CodeGenie completes it in an isolated cloud sandbox and opens a pull request.

> Status: in development, working towards the MVP. See [docs/knowledge/development-plan.md](docs/knowledge/development-plan.md).

## Repository layout

```
apps/
  web/        Next.js UI
  server/     Express API (auth, projects, tasks, live job events)
  agent/      AI coding agent (terminal REPL for now)
packages/
  shared/     Types shared across apps
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
- `apps/agent/.env`: `OPENAI_API_KEY`

Start each app in its own terminal:

```bash
pnpm dev:server   # API at http://localhost:3001
pnpm dev:web      # UI at http://localhost:3000
pnpm dev:agent    # terminal coding agent
```

Sign in at http://localhost:3000/signin.

## Common commands

| Command | What it does |
|---|---|
| `pnpm migrate` | Apply database migrations |
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

## License

ISC
