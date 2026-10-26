import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema/index.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** A database or a transaction on it: what a query can run against. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Opens a connection pool. Each app creates its own from its config, so nothing
 * connects on import and tests control their connection.
 */
export function createDb(url: string, pool: PoolConfig = {}) {
  const client = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
    ...pool,
  });
  return { db: drizzle({ client, schema }) as Db, pool: client };
}

/** Throws when the database can't be reached. */
export async function pingDatabase(db: Db) {
  await db.execute("SELECT 1");
}
