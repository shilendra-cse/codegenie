import { eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { user } from "../../schema/auth/auth-schema.js";

export type NewUser = typeof user.$inferInsert;

/** Creates the user unless one with the same id already exists. */
export async function ensureUser(db: Db, values: NewUser) {
  await db.insert(user).values(values).onConflictDoNothing();
}

export async function findUserIdByEmail(db: Db, email: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return row?.id ?? null;
}
