# @codegenie/db

The Postgres schema, client and migrations ([Drizzle](https://orm.drizzle.team)), shared by `apps/server` and `apps/worker`. Table design: [docs/knowledge/database.md](../../docs/knowledge/database.md).

```ts
import { createDb, jobs } from "@codegenie/db";

const { db, pool } = createDb(config.database.url); // each app, from its own config
await db.select().from(jobs);
```

## Rules

- **Data access only:** schema, client, migrations, and query helpers both apps need. Business rules stay in the apps.
- **Queries only one app needs stay in that app.**
- **Migrations run from one place** (`pnpm migrate`, the deploy step), never on app startup.
- **Each app creates its own connection** with `createDb(url)`; nothing connects on import.

## Commands

```bash
pnpm migrate                              # start Postgres if needed and apply migrations
pnpm --filter @codegenie/db generate      # write a migration after changing src/schema/
pnpm --filter @codegenie/db studio        # browse the data
```

The commands use the development database from `apps/server/docker-compose.yml`, configured in `apps/server/.env` (`DATABASE_URL`, or `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`).

## Tests

Tests that need Postgres get their own database:

```ts
import { testDatabaseOrSkip } from "@codegenie/db/testing";

const database = await testDatabaseOrSkip("my suite"); // fresh and migrated; null without Postgres
describe.skipIf(!database)("…", () => {
  afterAll(() => database?.drop());
});
```

It's created on the `TEST_DATABASE_URL` server, or next to the development database, and dropped afterwards. CI runs a Postgres service, so the tests are required there.

## Layout

```
src/
├── client.ts         createDb(url, poolOptions?)
├── environments.ts   DbEnvironmentStore: project environment versions
├── testing/          testDatabaseOrSkip (the @codegenie/db/testing export)
├── schema/           one file per table group; index.ts exports them all
└── index.ts          createDb, DbEnvironmentStore, every table, and the tables as `schema`
drizzle/          migrations and their snapshots (generated)
```
