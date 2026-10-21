import { eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { githubInstallations } from "../../schema/github/github-installations-schema.js";

export type NewInstallation = typeof githubInstallations.$inferInsert;

/** Creates the installation unless one with the same GitHub installation id exists; returns its row id. */
export async function ensureInstallation(db: Db, values: NewInstallation) {
  await db.insert(githubInstallations).values(values).onConflictDoNothing();
  const [installation] = await db
    .select({ id: githubInstallations.id })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, values.installationId));
  return installation!;
}
