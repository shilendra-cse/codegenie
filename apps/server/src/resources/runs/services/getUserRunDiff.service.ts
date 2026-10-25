import { type Db, getRunDiff } from "@hobai/db";
import { getUserRun } from "./getUserRun.service";

export async function getUserRunDiff(db: Db, userId: string, runId: string) {
  await getUserRun(db, userId, runId);
  const diff = await getRunDiff(db, runId);
  return diff
    ? { patch: diff.patch, files: diff.files, truncated: diff.truncated }
    : null;
}
