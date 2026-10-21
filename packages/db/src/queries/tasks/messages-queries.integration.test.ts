import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { messages } from "../../schema/index.js";
import { insertRun, testDatabaseOrSkip } from "../../testing/index.js";
import { getLatestUserMessage } from "./messages-queries.js";

const database = await testDatabaseOrSkip("messages queries");

describe.skipIf(!database)("messages queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  it("returns the latest message the user wrote for a run", async () => {
    const { task, run } = await insertRun(db);
    const other = await insertRun(db);
    const at = (minute: number) => new Date(2026, 9, 21, 10, minute);
    await db.insert(messages).values([
      {
        taskId: task.id,
        runId: run.id,
        role: "user",
        content: "first",
        createdAt: at(0),
      },
      {
        taskId: task.id,
        runId: run.id,
        role: "user",
        content: "latest",
        createdAt: at(1),
      },
      {
        taskId: task.id,
        runId: run.id,
        role: "assistant",
        content: "reply",
        createdAt: at(2),
      },
      {
        taskId: other.task.id,
        runId: other.run.id,
        role: "user",
        content: "other run",
        createdAt: at(3),
      },
    ]);

    expect(await getLatestUserMessage(db, run.id)).toMatchObject({
      content: "latest",
    });
  });

  it("returns null for a run without a user message", async () => {
    const { run } = await insertRun(db);
    expect(await getLatestUserMessage(db, run.id)).toBeNull();
  });
});
