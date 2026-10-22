import type { Db } from "@codegenie/db";
import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { runParamsSchema } from "./runs.types";
import { cancelRun, type Publisher } from "./services/cancelRun.service";
import { getUserRun } from "./services/getUserRun.service";
import { getUserRunDiff } from "./services/getUserRunDiff.service";

export type RunControllerDeps = { db: Db; publisher: Publisher };

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

  return { getRun, getRunDiff, cancel };
}
