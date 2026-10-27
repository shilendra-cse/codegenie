import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./client.js";

/** Applies the migrations in `folder` that haven't run yet. */
export async function migrateDatabase(db: Db, folder: string) {
  await migrate(db, { migrationsFolder: folder });
}
