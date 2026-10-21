import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { runEvents } from "../../schema/index.js";
import { insertRun, testDatabaseOrSkip } from "../../testing/index.js";
import { insertRunEvent } from "./run-events-queries.js";

const database = await testDatabaseOrSkip("run events queries");

describe.skipIf(!database)("run events queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  it("inserts numbered events, and refuses a number twice", async () => {
    const { run } = await insertRun(db);
    const at = new Date("2026-10-21T10:00:00Z");

    await insertRunEvent(db, {
      runId: run.id,
      seq: 1,
      type: "stage_changed",
      payload: { stage: "prepare" },
      createdAt: at,
    });

    expect(
      await db
        .select()
        .from(runEvents)
        .where(eq(runEvents.runId, run.id))
        .orderBy(asc(runEvents.seq)),
    ).toEqual([
      {
        runId: run.id,
        seq: 1,
        type: "stage_changed",
        payload: { stage: "prepare" },
        createdAt: at,
      },
    ]);
    await expect(
      insertRunEvent(db, { runId: run.id, seq: 1, type: "done" }),
    ).rejects.toThrow();
  });
});
