import { countCycleRuns, type Db, ensureSubscription } from "@hobai/db";
import type { UsageResponse } from "@hobai/shared";
import { HttpError } from "@/lib/http-error";

export async function getUsage(db: Db, userId: string): Promise<UsageResponse> {
  const subscription = await ensureSubscription(db, userId);
  if (!subscription) throw new HttpError(401, "Sign in again.");
  const { plan, periodStart, periodEnd } = subscription;
  const used = await countCycleRuns(db, userId, {
    start: periodStart,
    end: periodEnd,
  });
  return {
    plan: { slug: plan.slug, name: plan.name },
    runs: { used, limit: plan.runsPerCycle },
    concurrentRuns: plan.concurrentRuns,
    periodStart: periodStart.toISOString(),
    resetsAt: periodEnd.toISOString(),
  };
}
