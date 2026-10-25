# @hobai/db

The Postgres schema, client, migrations and **every query** ([Drizzle](https://orm.drizzle.team)), shared by `apps/server` and `apps/worker`. Table design: [docs/knowledge/database.md](../../docs/knowledge/database.md).

```ts
import { createDb, getRunWithProject, markRunStarted } from "@hobai/db";

const { db, pool } = createDb(config.database.url); // each app, from its own config
const run = await getRunWithProject(db, runId);
if (!(await markRunStarted(db, runId, environmentId))) {
  // the app decides what "not started" means
}
```

## Rules

- **Every query lives in `src/queries/`.** Apps call query functions; they never build queries (no `drizzle-orm` imports, no `db.insert/select/update/delete/query/execute/transaction`). ESLint enforces it in the apps through `@hobai/db/eslint`; tests may still read and write rows directly.
- **Queries hold no business rules.** They return what happened (`false` when a run wasn't queued, `null` when a row doesn't exist); the app decides what that means.
- **One function per operation**, taking `db` first: `markRunEnded(db, runId, outcome, from)`. Several writes that must happen together are one function with a transaction inside (`createTaskWithRun`).
- **Migrations run from one place** (`pnpm migrate`, the deploy step), never on app startup.
- **Each app creates its own connection** with `createDb(url)`; nothing connects on import.

## Commands

```bash
pnpm migrate                              # start Postgres if needed and apply migrations
pnpm --filter @hobai/db generate      # write a migration after changing src/schema/
pnpm --filter @hobai/db studio        # browse the data
```

The commands use the development database from `apps/server/docker-compose.yml`, configured in `apps/server/.env` (`DATABASE_URL`, or `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`).

## Tests

Tests that need Postgres get their own database:

```ts
import { testDatabaseOrSkip } from "@hobai/db/testing";

const database = await testDatabaseOrSkip("my suite"); // fresh and migrated; null without Postgres
describe.skipIf(!database)("…", () => {
  afterAll(() => database?.drop());
});
```

It's created on the `TEST_DATABASE_URL` server, or next to the development database, and dropped afterwards. CI runs a Postgres service, so the tests are required there.

## Layout

```
src/
├── client.ts         createDb(url, poolOptions?), pingDatabase
├── schema/           tables, one folder per domain; relations.ts at the root
│   ├── auth/  github/  projects/  tasks/  runs/
├── queries/          every query, the same folders as schema/
│   ├── auth/         accounts-queries.ts, users-queries.ts
│   ├── github/       installations-queries.ts, webhook-deliveries-queries.ts
│   ├── projects/     projects-queries.ts, environments-queries.ts (DbEnvironmentStore), onboardings-queries.ts
│   ├── tasks/        tasks-queries.ts, messages-queries.ts
│   └── runs/         runs-queries.ts, run-events-queries.ts, run-diffs-queries.ts
├── testing/          testDatabaseOrSkip, fixtures (the @hobai/db/testing export)
└── index.ts          createDb, every query, every table, and the tables as `schema`
eslint-query-layer.js the ESLint rule apps include (the @hobai/db/eslint export)
drizzle/              migrations and their snapshots (generated)

A table's file and its queries' file sit at the same place in both trees: `schema/runs/runs-schema.ts` and `queries/runs/runs-queries.ts`. Each query file has its tests next to it (`*-queries.integration.test.ts`), on a fresh database.
```
