import type { Db } from "@hobai/db";
import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import { getUsage } from "./services/getUsage.service";

export function createUsageControllers({ db }: { db: Db }) {
  const getMyUsage: AuthenticatedController = async (req) =>
    ok(200, "OK", await getUsage(db, req.user.id));

  return { getMyUsage };
}
