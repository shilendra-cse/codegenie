import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { messages } from "../../schema/tasks/messages-schema.js";

/** The latest message the user wrote for a run: its instruction. */
export async function getLatestUserMessage(db: Db, runId: string) {
  return (
    (await db.query.messages.findFirst({
      where: and(eq(messages.runId, runId), eq(messages.role, "user")),
      orderBy: desc(messages.createdAt),
    })) ?? null
  );
}
