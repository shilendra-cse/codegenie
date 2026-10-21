import { eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { runDiffs } from "../../schema/run-diffs-schema.js";

export type RunDiff = Omit<typeof runDiffs.$inferInsert, "runId" | "createdAt">;

/** Saving again replaces the run's diff: a run keeps only its latest. */
export async function saveRunDiff(db: Db, runId: string, diff: RunDiff) {
  await db
    .insert(runDiffs)
    .values({ runId, ...diff })
    .onConflictDoUpdate({ target: runDiffs.runId, set: diff });
}

export async function getRunDiff(db: Db, runId: string) {
  return (
    (await db.query.runDiffs.findFirst({ where: eq(runDiffs.runId, runId) })) ??
    null
  );
}
