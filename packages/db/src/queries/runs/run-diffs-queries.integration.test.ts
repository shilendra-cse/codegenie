import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { insertRun, testDatabaseOrSkip } from "../../testing/index.js";
import { getRunDiff, saveRunDiff } from "./run-diffs-queries.js";

const database = await testDatabaseOrSkip("run diffs queries");

const diff = (path: string) => ({
  patch: `diff --git a/${path} b/${path}\n`,
  files: [{ path, added: 3, removed: null }],
  truncated: false,
});

describe.skipIf(!database)("run diffs queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  it("has no diff for a run that changed nothing", async () => {
    const { run } = await insertRun(db);
    expect(await getRunDiff(db, run.id)).toBeNull();
  });

  it("keeps only the latest diff of a run", async () => {
    const { run } = await insertRun(db);

    await saveRunDiff(db, run.id, diff("a.md"));
    await saveRunDiff(db, run.id, diff("b.md"));

    expect(await getRunDiff(db, run.id)).toEqual({
      runId: run.id,
      ...diff("b.md"),
      createdAt: expect.any(Date),
    });
  });
});
