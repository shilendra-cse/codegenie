import { and, eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { account } from "../../schema/auth/auth-schema.js";

export async function findUserIdByGithubId(db: Db, githubUserId: number) {
  const row = await db.query.account.findFirst({
    columns: { userId: true },
    where: and(
      eq(account.providerId, "github"),
      eq(account.accountId, String(githubUserId)),
    ),
  });
  return row?.userId ?? null;
}
