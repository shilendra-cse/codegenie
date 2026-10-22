import type { Db } from "@codegenie/db";
import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { runParamsSchema } from "./runs.types";
import { getUserRun } from "./services/getUserRun.service";
import { getUserRunDiff } from "./services/getUserRunDiff.service";

export type RunControllerDeps = { db: Db };

export function createRunControllers({ db }: RunControllerDeps) {
  const getRun: AuthenticatedController = async (req) => {
    const { id } = runParamsSchema.parse(req.params);
    return ok(200, "OK", { run: await getUserRun(db, req.user.id, id) });
  };

  const getRunDiff: AuthenticatedController = async (req) => {
    const { id } = runParamsSchema.parse(req.params);
    return ok(200, "OK", { diff: await getUserRunDiff(db, req.user.id, id) });
  };

  return { getRun, getRunDiff };
}
