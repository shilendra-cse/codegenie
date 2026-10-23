import { type Db, findUserRun } from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import type { RunResponse } from "@codegenie/shared";
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
