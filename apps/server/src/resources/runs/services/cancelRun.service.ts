import { type Db, markRunEnded } from "@codegenie/db";
import { CANCEL_CHANNEL } from "@codegenie/shared";
import { HttpError } from "@/lib/http-error";
import { getUserRun } from "./getUserRun.service";

export type Publisher = {
  publish(channel: string, message: string): Promise<number>;
};

export async function cancelRun(
  deps: { db: Db; publisher: Publisher },
  userId: string,
  runId: string,
): Promise<"cancelled" | "stopping"> {
  const run = await getUserRun(deps.db, userId, runId);
  if (
    run.status === "queued" &&
    (await markRunEnded(deps.db, runId, { status: "cancelled" }, ["queued"]))
  ) {
    return "cancelled";
  }
  const { status } = await getUserRun(deps.db, userId, runId);
  if (status !== "running") {
    throw new HttpError(409, "This run has already ended.", "RUN_ENDED");
  }
  await deps.publisher.publish(CANCEL_CHANNEL, runId);
  return "stopping";
}
