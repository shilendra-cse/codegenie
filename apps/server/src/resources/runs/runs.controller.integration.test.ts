import { randomUUID } from "node:crypto";
import { type Db, runs } from "@codegenie/db";
import { insertRun, testDatabaseOrSkip } from "@codegenie/db/testing";
import { CANCEL_CHANNEL } from "@codegenie/shared";
import { eq } from "drizzle-orm";
import type { Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createRunControllers } from "./runs.controller";

const database = await testDatabaseOrSkip("run controllers");

describe.skipIf(!database)("cancelling runs against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());
  const published: [string, string][] = [];
  const controllers = createRunControllers({
    db,
    publisher: {
      publish(channel, message) {
        published.push([channel, message]);
        return Promise.resolve(1);
      },
    },
  });

  const cancel = (userId: string, runId: string) =>
    controllers.cancel(
      {
        user: { id: userId, email: `${userId}@example.com` },
        params: { id: runId },
      } as unknown as AuthenticatedRequest,
      {} as Response,
    );
  const status = async (runId: string) =>
    (await db.select().from(runs).where(eq(runs.id, runId)))[0]?.status;

  it("cancels a queued run at once, without the worker", async () => {
    const { project, run } = await insertRun(db);

    expect(await cancel(project.userId, run.id)).toMatchObject({
      status: 202,
      data: { outcome: "cancelled" },
    });
    expect(await status(run.id)).toBe("cancelled");
    expect(published).not.toContainEqual([CANCEL_CHANNEL, run.id]);
  });

  it("tells the worker to stop a running run", async () => {
    const { project, run } = await insertRun(db, { status: "running" });

    expect(await cancel(project.userId, run.id)).toMatchObject({
      data: { outcome: "stopping" },
    });
    expect(published).toContainEqual([CANCEL_CHANNEL, run.id]);
    expect(await status(run.id)).toBe("running");
  });

  it("refuses a run that has ended, and someone else's run", async () => {
    const { project, run } = await insertRun(db, { status: "succeeded" });

    await expect(cancel(project.userId, run.id)).rejects.toMatchObject({
      status: 409,
      code: "RUN_ENDED",
    });
    await expect(cancel(randomUUID(), run.id)).rejects.toMatchObject({
      status: 404,
      code: "RUN_NOT_FOUND",
    });
  });
});
