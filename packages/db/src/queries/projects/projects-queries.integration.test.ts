import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { insertProject, testDatabaseOrSkip } from "../../testing/index.js";
import { ensureUser } from "../auth/users-queries.js";
import { recordInstallation } from "../github/installations-queries.js";
import { getProject, upsertProject } from "./projects-queries.js";

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
