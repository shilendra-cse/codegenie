import { and, eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { account } from "../../schema/auth/auth-schema.js";

export async function getGithubAccount(db: Db, userId: string) {
  return (
    (await db.query.account.findFirst({
      where: and(eq(account.userId, userId), eq(account.providerId, "github")),
    })) ?? null
  );
}
