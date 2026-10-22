import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import {
  insertProject,
  insertRun,
  testDatabaseOrSkip,
} from "../../testing/index.js";
import { ensureUser } from "../auth/users-queries.js";
import { recordInstallation } from "../github/installations-queries.js";
import { DbEnvironmentStore } from "./environments-queries.js";
import {
  deleteProjectUnlessBusy,
  findUserProject,
  getProject,
  findUserProjects,
  findUserProjectForRepo,
  findUserProjectRepos,
  upsertProject,
} from "./projects-queries.js";

const database = await testDatabaseOrSkip("projects queries");

describe.skipIf(!database)("projects queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  async function owner() {
    const userId = randomUUID();
    await ensureUser(db, {
      id: userId,
      name: "Ada",
      email: `${userId}@example.com`,
    });
    const installation = await recordInstallation(db, {
      installationId: randomInt(1, 2 ** 31),
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    });
    return { userId, installation };
  }

  const config = {
    version: 1 as const,
    steps: [],
    checks: [],
    meta: { source: "detected" as const, createdAt: "", decisions: [] },
  };

  it("lists a user's projects, newest first, with the installation and only the active environment", async () => {
    const { userId, installation } = await owner();
    const project = (repoName: string) =>
      upsertProject(db, {
        userId,
        installationId: installation.id,
        repoGithubId: randomInt(1, 2 ** 31),
        repoOwner: "acme",
        repoName,
        defaultBranch: "main",
      });
    const older = await project("api");
    const newer = await project("web");
    const store = new DbEnvironmentStore(db);
    await store.save(older.id, config, "detected");
    await store.save(older.id, config, "user");
    await insertProject(db);

    const listed = await findUserProjects(db, userId);

    expect(listed.map((p) => p.repoName)).toEqual(["web", "api"]);
    expect(listed[0]).toMatchObject({ id: newer.id, environments: [] });
    expect(listed[1]!.installation).toMatchObject({ accountLogin: "acme" });
    expect(listed[1]!.environments).toEqual([
      expect.objectContaining({ version: 2, status: "active" }),
    ]);
    expect(listed[1]!.environments[0]).not.toHaveProperty("config");
  });

  it("gets a project only for the user it belongs to", async () => {
    const project = await insertProject(db);
    const { userId: someoneElse } = await owner();

    expect(await findUserProject(db, project.userId, project.id)).toMatchObject(
      {
        id: project.id,
        installation: { accountLogin: "acme" },
      },
    );
    expect(await findUserProject(db, someoneElse, project.id)).toBeNull();
    expect(await findUserProject(db, project.userId, randomUUID())).toBeNull();
  });

  it("lists which repositories a user already has as projects", async () => {
    const project = await insertProject(db);
    await insertProject(db);

    expect(await findUserProjectRepos(db, project.userId)).toEqual([
      { id: project.id, repoGithubId: project.repoGithubId },
    ]);
    expect(
      await findUserProjectForRepo(db, project.userId, project.repoGithubId),
    ).toEqual({ id: project.id });
    expect(await findUserProjectForRepo(db, project.userId, 1)).toBeNull();
  });

  it("deletes a project with its tasks and runs, unless a run is queued or running", async () => {
    const idle = await insertRun(db, { status: "succeeded" });
    const queued = await insertRun(db);
    const running = await insertRun(db, { status: "running" });

    expect(await deleteProjectUnlessBusy(db, idle.project.id)).toBe(true);
    expect(await deleteProjectUnlessBusy(db, queued.project.id)).toBe(false);
    expect(await deleteProjectUnlessBusy(db, running.project.id)).toBe(false);
    expect(await deleteProjectUnlessBusy(db, randomUUID())).toBe(false);

    expect(await getProject(db, idle.project.id)).toBeNull();
    expect(await getProject(db, queued.project.id)).not.toBeNull();
  });

  it("gets a project, or null", async () => {
    const project = await insertProject(db);
    expect(await getProject(db, project.id)).toMatchObject({
      id: project.id,
    });
    expect(await getProject(db, randomUUID())).toBeNull();
  });

  it("keeps one project per user and repository, updated to the repository's current details", async () => {
    const { userId, installation } = await owner();
    const values = {
      userId,
      installationId: installation.id,
      repoGithubId: randomInt(1, 2 ** 31),
      repoOwner: "acme",
      repoName: "app",
      defaultBranch: "master",
    };

    const first = await upsertProject(db, values);
    const again = await upsertProject(db, {
      ...values,
      repoName: "renamed-app",
      defaultBranch: "main",
    });

    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({
      repoName: "renamed-app",
      defaultBranch: "main",
    });
  });
});
