import type { Db } from "@codegenie/db";
import { ok } from "@/lib/api-response";
import { openSse } from "@/lib/sse";
import type {
  AuthenticatedController,
  AuthenticatedStream,
} from "@/types/base.types";
import { afterSeqSchema, runParamsSchema } from "./runs.types";
import { cancelRun, type Publisher } from "./services/cancelRun.service";
import { getUserRun } from "./services/getUserRun.service";
import { getUserRunDiff } from "./services/getUserRunDiff.service";
import {
  streamRunEvents,
  type StreamRunEventsDeps,
} from "./services/streamRunEvents.service";

export type RunControllerDeps = { db: Db; publisher: Publisher } & Pick<
  StreamRunEventsDeps,
  "hub" | "heartbeatMs"
>;

export function createRunControllers(deps: RunControllerDeps) {
  const { db } = deps;

  const getRun: AuthenticatedController = async (req) => {
    const { id } = runParamsSchema.parse(req.params);
    return ok(200, "OK", { run: await getUserRun(db, req.user.id, id) });
  };

  const getRunDiff: AuthenticatedController = async (req) => {
    const { id } = runParamsSchema.parse(req.params);
    return ok(200, "OK", { diff: await getUserRunDiff(db, req.user.id, id) });
  };

  const cancel: AuthenticatedController = async (req) => {
    const { id } = runParamsSchema.parse(req.params);
    const outcome = await cancelRun(deps, req.user.id, id);
    return ok(202, "Accepted", { outcome });
  };

  const streamEvents: AuthenticatedStream = async (req, res) => {
    const { id } = runParamsSchema.parse(req.params);
    const afterSeq = afterSeqSchema.parse(
      req.get("last-event-id") ?? req.query.after,
    );
    await streamRunEvents(deps, {
      userId: req.user.id,
      runId: id,
      afterSeq,
      open: () => openSse(res),
    });
  };

  return { getRun, getRunDiff, cancel, streamEvents };
}
