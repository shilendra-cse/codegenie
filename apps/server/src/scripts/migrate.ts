// node dist/migrate.js: applies new migrations; the production container runs it before the server.
import path from "node:path";
import { migrateDatabase } from "@hobai/db";
import { db, pool } from "@/db";

// The build copies packages/db/drizzle next to this file.
const MIGRATIONS = path.join(import.meta.dirname, "drizzle");

try {
  await migrateDatabase(db, MIGRATIONS);
  process.stdout.write("Migrations applied.\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
