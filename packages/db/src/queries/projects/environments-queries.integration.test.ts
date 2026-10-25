import type { EnvironmentConfig } from "@hobai/shared";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { projectEnvironments } from "../../schema/index.js";
import { insertProject, testDatabaseOrSkip } from "../../testing/index.js";
import {
  DbEnvironmentStore,
  restoreEnvironmentUnlessSettingUp,
} from "./environments-queries.js";
import { createOnboarding } from "./onboardings-queries.js";

const database = await testDatabaseOrSkip("DbEnvironmentStore");

const config = (command: string, commit?: string): EnvironmentConfig => ({
  version: 1,
  steps: [{ name: "install", cwd: ".", command }],
  checks: [{ name: "test", cwd: ".", command: "npm test" }],
  meta: {
    source: "detected",
    createdAt: "",
    decisions: [],
    ...(commit ? { commit } : {}),
  },
});

const newProject = async () => (await insertProject(database!.db)).id;

describe.skipIf(!database)("DbEnvironmentStore against Postgres", () => {
  const store = new DbEnvironmentStore(database?.db as Db);
  afterAll(() => database?.drop());

  it("has nothing for a project that wasn't set up", async () => {
    const projectId = await newProject();
    expect(await store.load(projectId)).toBeNull();
    expect(await store.list(projectId)).toEqual([]);
  });

  it("saves numbered versions; the newest is active and the others superseded", async () => {
    const projectId = await newProject();
    await store.save(projectId, config("npm ci", "c0ffee"), "detected");
    const second = await store.save(projectId, config("npm install"), "ai");

    expect(second).toMatchObject({
      id: expect.any(String),
      repoKey: projectId,
      version: 2,
      source: "ai",
      health: { status: "ok", reasons: [] },
    });
    expect(await store.load(projectId)).toMatchObject({
      version: 2,
      config: { steps: [{ command: "npm install" }] },
    });
    expect((await store.list(projectId)).map((v) => v.version)).toEqual([2, 1]);

    const rows = await database!.db
      .select({
        version: projectEnvironments.version,
        status: projectEnvironments.status,
        commit: projectEnvironments.verifiedCommit,
      })
      .from(projectEnvironments)
      .where(eq(projectEnvironments.projectId, projectId))
      .orderBy(projectEnvironments.version);
    expect(rows).toEqual([
      { version: 1, status: "superseded", commit: "c0ffee" },
      { version: 2, status: "active", commit: null },
    ]);
  });

  it("keeps versions in order when saves happen at the same time", async () => {
    const projectId = await newProject();
    await Promise.all([
      store.save(projectId, config("a"), "detected"),
      store.save(projectId, config("b"), "detected"),
      store.save(projectId, config("c"), "detected"),
    ]);
    const versions = await store.list(projectId);
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(await store.load(projectId)).toMatchObject({ version: 3 });
  });

  it("lets the database refuse a second active version", async () => {
    const projectId = await newProject();
    await store.save(projectId, config("npm ci"), "detected");
    await expect(
      database!.db.insert(projectEnvironments).values({
        projectId,
        version: 2,
        config: config("npm ci"),
        source: "detected",
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("marks the active version's health until a new version is saved", async () => {
    const projectId = await newProject();
    await store.save(projectId, config("npm ci"), "detected");
    await store.markHealth(projectId, "needs_attention", [
      "admin/ isn't covered.",
    ]);

    const flagged = await store.load(projectId);
    expect(flagged!.health).toMatchObject({
      status: "needs_attention",
      reasons: ["admin/ isn't covered."],
    });
    expect(flagged!.health.at).toEqual(expect.any(String));

    await store.save(projectId, config("npm ci"), "ai");
    expect((await store.load(projectId))!.health).toEqual({
      status: "ok",
      reasons: [],
    });
  });

  it("does nothing when marking a project without an environment, and refuses unknown projects", async () => {
    const projectId = await newProject();
    await store.markHealth(projectId, "needs_attention", ["x"]);
    expect(await store.load(projectId)).toBeNull();
    await expect(
      store.save(randomUUID(), config("npm ci"), "detected"),
    ).rejects.toThrow(/doesn't exist/);
  });

  describe("restoring a version", () => {
    const db = database?.db as Db;
    const versions = async (projectId: string) =>
      (await store.list(projectId)).map((v) => [v.version, v.active]);

    it("makes it active with the health it had; the next save comes after the newest", async () => {
      const projectId = await newProject();
      await store.save(projectId, config("npm ci"), "detected");
      await store.markHealth(projectId, "needs_attention", ["install failed"]);
      await store.save(projectId, config("npm install"), "ai");

      expect(
        await restoreEnvironmentUnlessSettingUp(db, projectId, 1),
      ).toMatchObject({
        status: "restored",
        environment: {
          version: 1,
          active: true,
          health: { status: "needs_attention", reasons: ["install failed"] },
        },
      });
      expect(await store.load(projectId)).toMatchObject({ version: 1 });
      expect(await versions(projectId)).toEqual([
        [2, false],
        [1, true],
      ]);

      expect(
        await restoreEnvironmentUnlessSettingUp(db, projectId, 1),
      ).toMatchObject({ status: "restored", environment: { version: 1 } });

      await store.save(projectId, config("pnpm install"), "ai");
      expect(await versions(projectId)).toEqual([
        [3, true],
        [2, false],
        [1, false],
      ]);
    });

    it("refuses an unknown version, and any while a setup is in progress", async () => {
      const project = await insertProject(db);
      await store.save(project.id, config("npm ci"), "detected");
      await store.save(project.id, config("npm install"), "ai");

      expect(
        await restoreEnvironmentUnlessSettingUp(db, project.id, 9),
      ).toEqual({ status: "not_found" });

      await createOnboarding(db, {
        projectId: project.id,
        userId: project.userId,
      });
      expect(
        await restoreEnvironmentUnlessSettingUp(db, project.id, 1),
      ).toEqual({ status: "setup_in_progress" });
      expect(await versions(project.id)).toEqual([
        [2, true],
        [1, false],
      ]);
    });
  });
});
