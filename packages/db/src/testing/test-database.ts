import { randomBytes } from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { createDb, type Db } from "../client.js";

const MIGRATIONS = path.join(import.meta.dirname, "..", "..", "drizzle");

export type TestDatabase = {
  db: Db;
  url: string;
  /** Closes the connections and drops the database. */
  drop(): Promise<void>;
};

/** TEST_DATABASE_URL, or the development database from apps/server/.env. */
function serverUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const env: Record<string, string> = {};
  loadEnv({
    path: path.join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "apps",
      "server",
      ".env",
    ),
    processEnv: env,
    quiet: true,
  });
  return env.DATABASE_URL ?? null;
}

/**
 * A fresh database with every migration applied, on the Postgres server of
 * TEST_DATABASE_URL (or the development one). The development database itself is
 * never touched. Returns null when no server is reachable, and fails in CI.
 */
export async function testDatabaseOrSkip(
  suite: string,
): Promise<TestDatabase | null> {
  const url = serverUrl();
  const admin = url ? new pg.Client({ connectionString: url }) : null;
  try {
    if (!admin) throw new Error("no TEST_DATABASE_URL or DATABASE_URL");
    await admin.connect();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.CI) {
      throw new Error(`${suite} tests need Postgres in CI: ${reason}`, {
        cause: error,
      });
    }
    console.warn(
      `Skipping ${suite} tests: Postgres isn't reachable (${reason})`,
    );
    return null;
  }

  const name = `codegenie_test_${randomBytes(4).toString("hex")}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const testUrl = new URL(url!);
  testUrl.pathname = `/${name}`;
  const { db, pool } = createDb(testUrl.toString(), { max: 5 });
  await migrate(db, { migrationsFolder: MIGRATIONS });

  return {
    db,
    url: testUrl.toString(),
    async drop() {
      // FORCE can cut off connections that are still closing; those errors are expected here.
      pool.on("error", () => {});
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
