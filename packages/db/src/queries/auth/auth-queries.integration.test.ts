import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { account, user } from "../../schema/index.js";
import { testDatabaseOrSkip } from "../../testing/index.js";
import { getGithubAccount } from "./accounts-queries.js";
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

  it("finds the user's GitHub account, not their other ones", async () => {
    const { id: userId } = newUser();
    await ensureUser(db, { ...newUser(), id: userId });
    await db.insert(account).values([
      {
        id: randomUUID(),
        accountId: "g-1",
        providerId: "google",
        userId,
        accessToken: "google-token",
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        accountId: "gh-1",
        providerId: "github",
        userId,
        accessToken: "github-token",
        updatedAt: new Date(),
      },
    ]);

    expect(await getGithubAccount(db, userId)).toMatchObject({
      accessToken: "github-token",
    });
    expect(await getGithubAccount(db, newUser().id)).toBeNull();
  });
});
