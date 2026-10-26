import { type Db, runs, setUserPlan } from "@hobai/db";
import {
  insertProject,
  insertTask,
  testDatabaseOrSkip,
} from "@hobai/db/testing";
import type { Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createUsageControllers } from "./usage.controller";

const database = await testDatabaseOrSkip("usage controllers");

describe.skipIf(!database)("usage controllers against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const usage = createUsageControllers({ db });
  const request = (userId: string) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
    }) as unknown as AuthenticatedRequest;
  const response = {} as Response;

  it("returns the plan, the runs used this cycle and when they reset", async () => {
    const project = await insertProject(db);
    const task = await insertTask(db, project);
    await db.insert(runs).values([
      { taskId: task.id, trigger: "initial", model: "m", status: "succeeded" },
      {
        taskId: task.id,
        trigger: "initial",
        model: "m",
        status: "failed",
        errorCode: "worker_lost",
      },
    ]);

    const result = await usage.getMyUsage(request(project.userId), response);

    expect(result).toMatchObject({
      status: 200,
      data: {
        plan: { slug: "free", name: "Free" },
        runs: { used: 1, limit: 10 },
        concurrentRuns: 1,
        periodStart: expect.any(String) as string,
        resetsAt: expect.any(String) as string,
      },
    });
  });

  it("has no run limit on the unlimited plan", async () => {
    const project = await insertProject(db);
    await setUserPlan(db, project.userId, "unlimited");

    expect(
      await usage.getMyUsage(request(project.userId), response),
    ).toMatchObject({
      data: {
        plan: { slug: "unlimited", name: "Unlimited" },
        runs: { used: 0, limit: null },
        concurrentRuns: 3,
      },
    });
  });
});
