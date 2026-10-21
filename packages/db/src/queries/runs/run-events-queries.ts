import type { Db } from "../../client.js";
import { runEvents } from "../../schema/runs/run-events-schema.js";

export type NewRunEvent = typeof runEvents.$inferInsert;

export async function insertRunEvent(db: Db, event: NewRunEvent) {
  await db.insert(runEvents).values(event);
}
