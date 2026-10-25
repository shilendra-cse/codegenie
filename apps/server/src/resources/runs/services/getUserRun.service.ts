import { type Db, findUserRun } from "@hobai/db";
import { HttpError } from "@/lib/http-error";
import type { RunResponse } from "@hobai/shared";
import { toRunResponse } from "../runs.types";

export async function getUserRun(
  db: Db,
  userId: string,
  runId: string,
): Promise<RunResponse> {
  const run = await findUserRun(db, userId, runId);
  if (!run) throw new HttpError(404, "Run not found.", "RUN_NOT_FOUND");
  return toRunResponse(run);
}
