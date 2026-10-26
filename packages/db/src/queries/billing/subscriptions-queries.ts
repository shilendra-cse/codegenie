import { and, eq } from "drizzle-orm";
import type { Db } from "../../client.js";
import { user } from "../../schema/auth/auth-schema.js";
import { plans } from "../../schema/billing/plans-schema.js";
import { subscriptions } from "../../schema/billing/subscriptions-schema.js";
import { cycleAt } from "./cycle.js";

export type Plan = typeof plans.$inferSelect;

export type Subscription = {
  plan: Pick<Plan, "slug" | "name" | "runsPerCycle" | "concurrentRuns">;
  source: (typeof subscriptions.$inferSelect)["source"];
  periodStart: Date;
  periodEnd: Date;
};

const FREE_PLAN = "free";

async function findSubscriptionRow(db: Db, userId: string) {
  return (
    (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      with: { plan: true, user: { columns: { createdAt: true } } },
    })) ?? null
  );
}

function toSubscription(
  row: NonNullable<Awaited<ReturnType<typeof findSubscriptionRow>>>,
): Subscription {
  const { slug, name, runsPerCycle, concurrentRuns } = row.plan;
  return {
    plan: { slug, name, runsPerCycle, concurrentRuns },
    source: row.source,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  };
}

export async function findPlanBySlug(db: Db, slug: string) {
  return (
    (await db.query.plans.findFirst({ where: eq(plans.slug, slug) })) ?? null
  );
}

/**
 * The user's subscription with its current cycle. A user without one is put on the free plan,
 * cycles counted from their signup; a cycle that has ended moves forward. Null if there's no
 * such user.
 */
export async function ensureSubscription(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<Subscription | null> {
  let row = await findSubscriptionRow(db, userId);
  if (!row) {
    const [owner] = await db
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, userId));
    const free = await findPlanBySlug(db, FREE_PLAN);
    if (!owner || !free) return null;
    const cycle = cycleAt(owner.createdAt, now);
    await db
      .insert(subscriptions)
      .values({
        userId,
        planId: free.id,
        source: "signup",
        periodStart: cycle.start,
        periodEnd: cycle.end,
      })
      .onConflictDoNothing();
    row = await findSubscriptionRow(db, userId);
  } else if (row.periodEnd <= now) {
    const cycle = cycleAt(row.user.createdAt, now);
    await db
      .update(subscriptions)
      .set({ periodStart: cycle.start, periodEnd: cycle.end })
      .where(
        and(
          eq(subscriptions.id, row.id),
          eq(subscriptions.periodEnd, row.periodEnd),
        ),
      );
    row = await findSubscriptionRow(db, userId);
  }
  return row ? toSubscription(row) : null;
}

/** Moves the user to another plan, keeping their cycle. Null if the user or the plan doesn't exist. */
export async function setUserPlan(
  db: Db,
  userId: string,
  planSlug: string,
): Promise<Subscription | null> {
  const plan = await findPlanBySlug(db, planSlug);
  if (!plan || !(await ensureSubscription(db, userId))) return null;
  await db
    .update(subscriptions)
    .set({ planId: plan.id, source: "admin" })
    .where(eq(subscriptions.userId, userId));
  return ensureSubscription(db, userId);
}
