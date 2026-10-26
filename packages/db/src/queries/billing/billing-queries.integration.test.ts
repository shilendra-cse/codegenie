import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { onboardings, runs, subscriptions, user } from "../../schema/index.js";
import {
  insertProject,
  insertTask,
  testDatabaseOrSkip,
} from "../../testing/index.js";
import { ensureSubscription, setUserPlan } from "./subscriptions-queries.js";
import {
  countActiveRuns,
  countCycleRuns,
  spendToday,
} from "./usage-queries.js";

const database = await testDatabaseOrSkip("billing queries");

const at = (iso: string) => new Date(iso);

describe.skipIf(!database)("billing queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const signUp = async (createdAt: Date) => {
    const id = randomUUID();
    await db
      .insert(user)
      .values({ id, name: "Ada", email: `${id}@example.com`, createdAt });
    return id;
  };

  describe("subscriptions", () => {
    it("puts a user on the free plan, the cycle counted from signup", async () => {
      const userId = await signUp(at("2026-10-25T09:30:00Z"));

      const subscription = await ensureSubscription(
        db,
        userId,
        at("2026-11-02T00:00:00Z"),
      );

      expect(subscription).toEqual({
        plan: {
          slug: "free",
          name: "Free",
          runsPerCycle: 10,
          concurrentRuns: 1,
        },
        source: "signup",
        periodStart: at("2026-10-25T09:30:00Z"),
        periodEnd: at("2026-11-25T09:30:00Z"),
      });
    });

    it("keeps one subscription per user", async () => {
      const userId = await signUp(at("2026-10-25T09:30:00Z"));
      const now = at("2026-11-02T00:00:00Z");

      await Promise.all([
        ensureSubscription(db, userId, now),
        ensureSubscription(db, userId, now),
      ]);

      expect(
        await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId)),
      ).toHaveLength(1);
    });

    it("moves an ended cycle forward", async () => {
      const userId = await signUp(at("2026-10-25T09:30:00Z"));
      await ensureSubscription(db, userId, at("2026-11-02T00:00:00Z"));

      const later = await ensureSubscription(
        db,
        userId,
        at("2027-01-30T00:00:00Z"),
      );

      expect(later).toMatchObject({
        periodStart: at("2027-01-25T09:30:00Z"),
        periodEnd: at("2027-02-25T09:30:00Z"),
      });
    });

    it("is null for a user who doesn't exist", async () => {
      expect(await ensureSubscription(db, randomUUID())).toBeNull();
    });

    it("moves a user to another plan, keeping the cycle", async () => {
      const userId = await signUp(new Date());
      const before = await ensureSubscription(db, userId);

      const after = await setUserPlan(db, userId, "unlimited");

      expect(after).toEqual({
        plan: {
          slug: "unlimited",
          name: "Unlimited",
          runsPerCycle: null,
          concurrentRuns: 3,
        },
        source: "admin",
        periodStart: before?.periodStart,
        periodEnd: before?.periodEnd,
      });
      expect(await setUserPlan(db, userId, "platinum")).toBeNull();
      expect(await setUserPlan(db, randomUUID(), "free")).toBeNull();
    });
  });

  describe("usage", () => {
    const cycle = {
      start: at("2026-10-25T00:00:00Z"),
      end: at("2026-11-25T00:00:00Z"),
    };

    it("counts the user's runs in the cycle, except those that failed on hobai's side", async () => {
      const project = await insertProject(db);
      const task = await insertTask(db, project);
      const run = (values: Partial<typeof runs.$inferInsert>) =>
        db.insert(runs).values({
          taskId: task.id,
          trigger: "initial",
          model: "test:scripted",
          status: "succeeded",
          queuedAt: at("2026-11-01T00:00:00Z"),
          ...values,
        });
      await run({});
      await run({ status: "cancelled" });
      await run({ status: "failed", errorCode: "agent_failed" });
      await run({ status: "failed", errorCode: null });
      await run({ status: "failed", errorCode: "worker_lost" });
      await run({ status: "failed", errorCode: "queue_unavailable" });
      await run({ queuedAt: at("2026-10-24T23:59:59Z") });
      await run({ queuedAt: at("2026-11-25T00:00:00Z") });
      const other = await insertProject(db);
      await db.insert(runs).values({
        taskId: (await insertTask(db, other)).id,
        trigger: "initial",
        model: "test:scripted",
        queuedAt: at("2026-11-01T00:00:00Z"),
      });

      expect(await countCycleRuns(db, project.userId, cycle)).toBe(4);
    });

    it("counts the user's queued and running runs", async () => {
      const project = await insertProject(db);
      const run = async (status: (typeof runs.$inferInsert)["status"]) =>
        db.insert(runs).values({
          taskId: (await insertTask(db, project)).id,
          trigger: "initial",
          model: "test:scripted",
          status,
        });
      await run("queued");
      await run("running");
      await run("succeeded");

      expect(await countActiveRuns(db, project.userId)).toBe(2);
    });

    it("adds up today's model cost of runs and setups, for everyone", async () => {
      const now = at("2031-03-03T15:00:00Z");
      const before = await spendToday(db, now);
      const project = await insertProject(db);
      const task = await insertTask(db, project);
      await db.insert(runs).values([
        {
          taskId: task.id,
          trigger: "initial",
          model: "m",
          costUsd: "0.2500",
          queuedAt: at("2031-03-03T01:00:00Z"),
        },
        {
          taskId: task.id,
          trigger: "initial",
          model: "m",
          costUsd: "9.0000",
          queuedAt: at("2031-03-02T23:59:00Z"),
          status: "succeeded",
        },
      ]);
      await db.insert(onboardings).values({
        projectId: project.id,
        costUsd: "0.1000",
        status: "succeeded",
        queuedAt: at("2031-03-03T02:00:00Z"),
      });

      expect((await spendToday(db, now)) - before).toBeCloseTo(0.35);
    });
  });
});
