import { randomInt, randomUUID } from "node:crypto";
import {
  ensureUser,
  markInstallationUninstalled,
  messages,
  recordInstallation,
  runs,
  type Db,
} from "@codegenie/db";
import type { InstalledRepo } from "@codegenie/github";
import { testDatabaseOrSkip } from "@codegenie/db/testing";
import { CANCEL_CHANNEL, WORK_QUEUE } from "@codegenie/shared";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cancelRun,
  enqueueOnboarding,
  enqueueRun,
  ensureProject,
  InstallationNotRecordedError,
} from "./work.js";
import type { Publisher } from "../events/sink.js";
import { testRedisOrSkip } from "../testing/test-redis.js";

const database = await testDatabaseOrSkip("enqueue");
const redis = await testRedisOrSkip("enqueue");

const installerId = randomUUID();
const helloWorld: InstalledRepo = {
  installationId: randomInt(1, 2 ** 31),
  id: 1296269,
  owner: "octocat",
  name: "Hello-World",
  defaultBranch: "master",
  private: false,
};

describe.skipIf(!database || !redis)(
  "enqueue against Postgres and Redis",
  () => {
    const db = database?.db as Db;
    const { prefix, connect } = redis!;
    const queue = new Queue(WORK_QUEUE, { connection: connect(), prefix });
    beforeAll(async () => {
      await ensureUser(db, {
        id: installerId,
        name: "Ada",
        email: `${installerId}@example.com`,
      });
      await recordInstallation(db, {
        installationId: helloWorld.installationId,
        accountLogin: "octocat",
        accountType: "user",
        installedByUserId: installerId,
      });
    });
    afterAll(async () => {
      await queue.close();
      await redis?.close();
      await database?.drop();
    });

    it("creates a project once and keeps its repository details current", async () => {
      const first = await ensureProject(db, helloWorld);
      const again = await ensureProject(db, {
        ...helloWorld,
        defaultBranch: "main",
      });

      expect(again.id).toBe(first.id);
      expect(again).toMatchObject({
        userId: installerId,
        repoOwner: "octocat",
        repoName: "Hello-World",
        defaultBranch: "main",
      });
    });

    it("refuses a repository whose installation isn't recorded, or was uninstalled", async () => {
      const elsewhere = {
        ...helloWorld,
        installationId: randomInt(1, 2 ** 31),
      };
      await expect(ensureProject(db, elsewhere)).rejects.toBeInstanceOf(
        InstallationNotRecordedError,
      );

      const gone = { ...helloWorld, installationId: randomInt(1, 2 ** 31) };
      await recordInstallation(db, {
        installationId: gone.installationId,
        accountLogin: "octocat",
        accountType: "user",
        installedByUserId: installerId,
      });
      await markInstallationUninstalled(db, gone.installationId);
      await expect(ensureProject(db, gone)).rejects.toBeInstanceOf(
        InstallationNotRecordedError,
      );
    });

    it("inserts the task, message and queued run, and queues the run by its id", async () => {
      const project = await ensureProject(db, helloWorld);
      const { task, run, job } = await enqueueRun(db, queue, {
        project,
        instruction: "Add a README section\nwith install steps",
        model: "openai:gpt-6-luna",
      });

      expect(task).toMatchObject({
        title: "Add a README section",
        baseBranch: "master",
      });
      expect(run).toMatchObject({ status: "queued", trigger: "initial" });
      expect(
        await db.select().from(messages).where(eq(messages.runId, run.id)),
      ).toMatchObject([
        { role: "user", content: "Add a README section\nwith install steps" },
      ]);
      expect(job).toMatchObject({ id: run.id, name: "run-task" });
      expect(job.data).toEqual({ runId: run.id });
    });

    it("queues one onboarding per project at a time", async () => {
      const project = await ensureProject(db, helloWorld);
      const first = await enqueueOnboarding(queue, project.id);
      const second = await enqueueOnboarding(queue, project.id);

      expect(second.id).toBe(first.id);
      const waiting = await queue.getWaiting();
      expect(waiting.filter((j) => j.name === "onboard-project")).toHaveLength(
        1,
      );
    });

    it("cancels a queued run in the database and signals a running one", async () => {
      const project = await ensureProject(db, helloWorld);
      const published: [string, string][] = [];
      const publisher: Publisher = {
        async publish(channel, message) {
          published.push([channel, message]);
          return 1;
        },
      };
      const enqueue = () =>
        enqueueRun(db, queue, { project, instruction: "x", model: "m" });

      const { run: queued } = await enqueue();
      expect(await cancelRun(db, publisher, queued.id)).toBe("cancelled");
      expect(
        (await db.select().from(runs).where(eq(runs.id, queued.id)))[0],
      ).toMatchObject({ status: "cancelled", finishedAt: expect.any(Date) });
      expect(published).toEqual([]);

      const { run: running } = await enqueue();
      await db
        .update(runs)
        .set({ status: "running" })
        .where(eq(runs.id, running.id));
      expect(await cancelRun(db, publisher, running.id)).toBe("signalled");
      expect(published).toEqual([[CANCEL_CHANNEL, running.id]]);
    });
  },
);
