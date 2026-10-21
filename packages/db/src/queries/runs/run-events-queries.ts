import { eq, max } from "drizzle-orm";
import type { Db } from "../../client.js";
import { runEvents } from "../../schema/runs/run-events-schema.js";

export type NewRunEvent = typeof runEvents.$inferInsert;

export async function insertRunEvent(db: Db, event: NewRunEvent) {
  await db.insert(runEvents).values(event);
}

export async function getLastRunEventSeq(db: Db, runId: string) {
  const [row] = await db
    .select({ seq: max(runEvents.seq) })
    .from(runEvents)
    .where(eq(runEvents.runId, runId));
  return row?.seq ?? 0;
}
