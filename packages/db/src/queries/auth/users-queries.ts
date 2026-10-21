import type { Db } from "../../client.js";
import { user } from "../../schema/auth/auth-schema.js";

export type NewUser = typeof user.$inferInsert;

/** Creates the user unless one with the same id already exists. */
export async function ensureUser(db: Db, values: NewUser) {
  await db.insert(user).values(values).onConflictDoNothing();
}
