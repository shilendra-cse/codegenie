import { describe, expect, it } from "vitest";
import { createDb } from "./client.js";
import { jobs } from "./schema/index.js";

describe("createDb", () => {
  it("creates a pool from the url without connecting, with overridable options", async () => {
    const { db, pool } = createDb("postgresql://u:p@localhost:5432/test", {
      max: 3,
    });
    expect(pool.options).toMatchObject({
      connectionString: "postgresql://u:p@localhost:5432/test",
      max: 3,
      idleTimeoutMillis: 30_000,
    });
    expect(pool.totalCount).toBe(0);
    expect(db.select().from(jobs).toSQL().sql).toContain('from "jobs"');
    await pool.end();
  });
});
