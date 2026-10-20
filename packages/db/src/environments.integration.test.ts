import type { EnvironmentConfig } from "@codegenie/shared";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "./client.js";
import { DbEnvironmentStore } from "./environments.js";
import {
  githubInstallations,
  projectEnvironments,
  projects,
  user,
} from "./schema/index.js";
import { testDatabaseOrSkip } from "./testing/index.js";

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

let installations = 0;
async function newProject() {
  const db = database!.db;
  const userId = randomUUID();
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` });
  const [installation] = await db
    .insert(githubInstallations)
    .values({
      installationId: ++installations,
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      installationId: installation!.id,
      repoGithubId: installations,
      repoOwner: "acme",
      repoName: "app",
      defaultBranch: "main",
    })
    .returning();
  return project!.id;
}

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
});
