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

## Layout

```
src/
├── client.ts     createDb(url, poolOptions?)
├── schema/       one file per table group; index.ts exports them all
└── index.ts      createDb, every table, and the tables as `schema`
drizzle/          migrations and their snapshots (generated)
```
