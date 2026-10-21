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

export type InstallationAccount = Pick<
  NewInstallation,
  "installationId" | "accountLogin" | "accountType" | "installedByUserId"
>;

export async function recordInstallation(db: Db, values: InstallationAccount) {
  const [installation] = await db
    .insert(githubInstallations)
    .values(values)
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: {
        accountLogin: values.accountLogin,
        accountType: values.accountType,
        installedByUserId: values.installedByUserId,
        suspendedAt: null,
        uninstalledAt: null,
      },
    })
    .returning();
  return installation!;
}

export async function getInstallation(db: Db, installationId: number) {
  return (
    (await db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.installationId, installationId),
    })) ?? null
  );
}

export async function getInstallationById(db: Db, id: string) {
  return (
    (await db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.id, id),
    })) ?? null
  );
}

export async function setInstallationSuspended(
  db: Db,
  installationId: number,
  suspended: boolean,
) {
  const updated = await db
    .update(githubInstallations)
    .set({ suspendedAt: suspended ? new Date() : null })
    .where(eq(githubInstallations.installationId, installationId))
    .returning({ id: githubInstallations.id });
  return updated.length > 0;
}

export async function markInstallationUninstalled(
  db: Db,
  installationId: number,
) {
  const updated = await db
    .update(githubInstallations)
    .set({ uninstalledAt: new Date() })
    .where(eq(githubInstallations.installationId, installationId))
    .returning({ id: githubInstallations.id });
  return updated.length > 0;
}
