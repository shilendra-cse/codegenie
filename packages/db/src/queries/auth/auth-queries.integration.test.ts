import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { account, user } from "../../schema/index.js";
import { testDatabaseOrSkip } from "../../testing/index.js";
import { findUserIdByGithubId } from "./accounts-queries.js";
import { ensureUser } from "./users-queries.js";

const database = await testDatabaseOrSkip("auth queries");

describe.skipIf(!database)("auth queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const newUser = () => {
    const id = randomUUID();
    return { id, name: "Ada", email: `${id}@example.com` };
  };

  it("creates a user once", async () => {
    const values = newUser();

    await ensureUser(db, values);
    await ensureUser(db, { ...values, name: "Changed" });

    expect(
      await db.select().from(user).where(eq(user.id, values.id)),
    ).toMatchObject([{ name: "Ada" }]);
  });

  it("finds the user signed in with a GitHub id", async () => {
    const { id: userId } = newUser();
    await ensureUser(db, { ...newUser(), id: userId });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: "4242",
      providerId: "github",
      userId,
      updatedAt: new Date(),
    });

    expect(await findUserIdByGithubId(db, 4242)).toBe(userId);
    expect(await findUserIdByGithubId(db, 9999)).toBeNull();
  });
});
