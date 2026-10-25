import { randomInt, randomUUID } from "node:crypto";
import {
  createOnboarding,
  type Db,
  DbEnvironmentStore,
  ensureUser,
  markInstallationUninstalled,
  recordInstallation,
  setInstallationSuspended,
} from "@hobai/db";
import {
  insertProject,
  insertRun,
  testDatabaseOrSkip,
} from "@hobai/db/testing";
import { fakeGithub } from "@hobai/github/testing";
import type { Response } from "express";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http-error";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createProjectControllers } from "./projects.controller";

const database = await testDatabaseOrSkip("project controllers");

describe.skipIf(!database)("project controllers against Postgres", () => {
  const db = database?.db as Db;
  const repoId = randomInt(1, 2 ** 31);
  let githubToken: string | null = "ghu_user";
  const visibleToUser = new Set<number>();
  const github = fakeGithub((call) =>
    call.path === "/repos/acme/app/branches"
      ? {
          status: 200,
          body: [{ name: "develop" }, { name: "main" }, { name: "release/1" }],
        }
      : visibleToUser.has(
            Number(
              /^\/user\/installations\/(\d+)\/repositories$/.exec(
                call.path,
              )?.[1],
            ),
          )
        ? {
            status: 200,
            body: {
              total_count: 1,
              repositories: [
                {
                  id: repoId,
                  full_name: "acme/web",
                  owner: { login: "acme" },
                  name: "web",
                  default_branch: "trunk",
                  private: true,
                  html_url: "https://github.com/acme/web",
                  updated_at: "2026-10-01T00:00:00Z",
                },
              ],
            },
          }
        : { status: 404, body: { message: "Not Found" } },
  );
  const projects = createProjectControllers({
    db,
    githubToken: () => Promise.resolve(githubToken),
    fetch: github.fetch,
  });
  afterAll(() => database?.drop());

  const request = (
    userId: string,
    params: Record<string, string> = {},
    body: unknown = undefined,
  ) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
      params,
      body,
    }) as unknown as AuthenticatedRequest;

  async function userWithInstallation({ visible = true } = {}) {
    const userId = randomUUID();
    await ensureUser(db, {
      id: userId,
      name: "Ada",
      email: `${userId}@example.com`,
    });
    const installationId = randomInt(1, 2 ** 31);
    await recordInstallation(db, {
      installationId,
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    });
    if (visible) visibleToUser.add(installationId);
    return { userId, installationId };
  }
  const response = {} as Response;

  it("lists only the user's projects, with their environment and installation", async () => {
    const mine = await insertProject(db);
    await insertProject(db);
    await new DbEnvironmentStore(db).save(
      mine.id,
      {
        version: 1,
        steps: [],
        checks: [],
        meta: { source: "detected", createdAt: "", decisions: [] },
      },
      "detected",
    );
    const { onboarding } = await createOnboarding(db, {
      projectId: mine.id,
      userId: mine.userId,
    });

    const result = await projects.listProjects(request(mine.userId), response);

    expect(result).toMatchObject({
      status: 200,
      data: {
        projects: [
          {
            id: mine.id,
            repo: { githubId: mine.repoGithubId, owner: "acme", name: "app" },
            defaultBranch: "main",
            environment: {
              version: 1,
              health: "ok",
              healthReasons: [],
            },
            installation: {
              id: expect.any(Number) as number,
              accountLogin: "acme",
              accountType: "organization",
              suspended: false,
              uninstalled: false,
            },
            setup: { id: onboarding.id, status: "queued" },
          },
        ],
      },
    });
  });

  it("gets the user's project, without an environment until it's set up", async () => {
    const project = await insertProject(db);

    const result = await projects.getProject(
      request(project.userId, { id: project.id }),
      response,
    );

    expect(result).toMatchObject({
      status: 200,
      data: { project: { id: project.id, environment: null, setup: null } },
    });
  });

  it.each([
    ["someone else's project", "other"],
    ["a project that doesn't exist", "missing"],
  ])("answers 404 for %s", async (_case, which) => {
    const project = await insertProject(db);
    const failure = projects.getProject(
      which === "other"
        ? request(randomUUID(), { id: project.id })
        : request(project.userId, { id: randomUUID() }),
      response,
    );

    await expect(failure).rejects.toBeInstanceOf(HttpError);
    await expect(failure).rejects.toMatchObject({
      status: 404,
      code: "PROJECT_NOT_FOUND",
    });
  });

  it("refuses an id that isn't a UUID", async () => {
    await expect(
      projects.getProject(request(randomUUID(), { id: "42" }), response),
    ).rejects.toBeInstanceOf(ZodError);
  });

  describe("adding a project", () => {
    it("creates it from a repository the user can see, then returns the same one", async () => {
      githubToken = "ghu_user";
      const { userId, installationId } = await userWithInstallation();
      const add = () =>
        projects.addProject(
          request(userId, {}, { installationId, repoId }),
          response,
        );

      const created = await add();
      const again = await add();

      expect(created).toMatchObject({
        status: 201,
        data: {
          project: {
            repo: { githubId: repoId, owner: "acme", name: "web" },
            defaultBranch: "trunk",
            environment: null,
            installation: { accountLogin: "acme", suspended: false },
          },
        },
      });
      expect(again).toMatchObject({ status: 200, data: created.data });
      expect(github.calls.at(-1)).toMatchObject({
        path: `/user/installations/${installationId}/repositories`,
        authorization: "token ghu_user",
      });
    });

    it.each([
      [
        "an uninstalled App",
        "uninstalled",
        404,
        "GITHUB_INSTALLATION_NOT_FOUND",
      ],
      [
        "an installation that isn't recorded",
        "unrecorded",
        404,
        "GITHUB_INSTALLATION_NOT_FOUND",
      ],
      ["a suspended App", "suspended", 409, "GITHUB_INSTALLATION_SUSPENDED"],
      [
        "an installation GitHub doesn't show the user",
        "not-visible",
        404,
        "GITHUB_INSTALLATION_NOT_FOUND",
      ],
      [
        "a repository the user can't see",
        "hidden-repo",
        404,
        "GITHUB_REPOSITORY_NOT_FOUND",
      ],
      [
        "a user signed out of GitHub",
        "signed-out",
        401,
        "GITHUB_SIGN_IN_REQUIRED",
      ],
    ])("refuses %s", async (_case, state, status, code) => {
      githubToken = state === "signed-out" ? null : "ghu_user";
      const { userId, installationId } = await userWithInstallation({
        visible: state !== "not-visible",
      });
      if (state === "uninstalled") {
        await markInstallationUninstalled(db, installationId);
      }
      if (state === "suspended") {
        await setInstallationSuspended(db, installationId, true);
      }
      const body = {
        installationId:
          state === "unrecorded" ? randomInt(1, 2 ** 31) : installationId,
        repoId: state === "hidden-repo" ? repoId + 1 : repoId,
      };

      const failure = projects.addProject(request(userId, {}, body), response);

      await expect(failure).rejects.toBeInstanceOf(HttpError);
      await expect(failure).rejects.toMatchObject({ status, code });
    });

    it("refuses a body without numeric ids", async () => {
      await expect(
        projects.addProject(
          request(randomUUID(), {}, { installationId: "1", repoId: 2 }),
          response,
        ),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe("removing a project", () => {
    it("deletes the user's project", async () => {
      const { project } = await insertRun(db, { status: "succeeded" });
      const params = { id: project.id };

      const result = await projects.deleteProject(
        request(project.userId, params),
        response,
      );

      expect(result).toMatchObject({ status: 200, data: { id: project.id } });
      await expect(
        projects.getProject(request(project.userId, params), response),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("refuses while a run is queued or running, and someone else's project", async () => {
      const { project } = await insertRun(db, { status: "running" });

      await expect(
        projects.deleteProject(
          request(project.userId, { id: project.id }),
          response,
        ),
      ).rejects.toMatchObject({ status: 409, code: "PROJECT_BUSY" });
      await expect(
        projects.deleteProject(
          request(randomUUID(), { id: project.id }),
          response,
        ),
      ).rejects.toMatchObject({ status: 404, code: "PROJECT_NOT_FOUND" });
    });
  });

  describe("listing branches", () => {
    beforeEach(() => {
      githubToken = "ghu_user";
    });

    it("lists the repository's branches, the default first", async () => {
      const project = await insertProject(db);

      expect(
        await projects.getBranches(
          request(project.userId, { id: project.id }),
          response,
        ),
      ).toMatchObject({
        status: 200,
        data: {
          branches: ["main", "develop", "release/1"],
          defaultBranch: "main",
          truncated: false,
        },
      });
      expect(github.calls.at(-1)).toMatchObject({
        path: "/repos/acme/app/branches",
        authorization: "token ghu_user",
      });
    });

    it("refuses someone else's project, and a repository that's gone", async () => {
      const project = await insertProject(db);
      const gone = await insertProject(db, { repoName: "gone" });

      await expect(
        projects.getBranches(
          request(randomUUID(), { id: project.id }),
          response,
        ),
      ).rejects.toMatchObject({ status: 404, code: "PROJECT_NOT_FOUND" });
      await expect(
        projects.getBranches(request(gone.userId, { id: gone.id }), response),
      ).rejects.toMatchObject({
        status: 404,
        code: "GITHUB_REPOSITORY_NOT_FOUND",
      });
    });
  });

  describe("listing environment versions", () => {
    const config = (command: string) => ({
      version: 1 as const,
      steps: [{ name: "install", cwd: ".", command }],
      checks: [],
      meta: {
        source: "ai" as const,
        createdAt: "",
        decisions: [{ question: "Use npm?", answer: "Yes", auto: false }],
      },
    });

    it("lists the saved versions, newest first", async () => {
      const project = await insertProject(db);
      const store = new DbEnvironmentStore(db);
      const environments = (userId: string) =>
        projects.getEnvironments(request(userId, { id: project.id }), response);

      expect(await environments(project.userId)).toMatchObject({
        status: 200,
        data: { environments: [] },
      });

      await store.save(project.id, config("npm ci"), "ai");
      await store.save(project.id, config("npm install"), "ai");

      const result = await environments(project.userId);
      expect(result).toMatchObject({
        status: 200,
        data: {
          environments: [
            {
              version: 2,
              active: true,
              source: "ai",
              health: "ok",
              healthReasons: [],
              steps: [{ name: "install", cwd: ".", command: "npm install" }],
              checks: [],
              decisions: [{ question: "Use npm?", answer: "Yes", auto: false }],
            },
            { version: 1, active: false },
          ],
        },
      });
      await expect(environments(randomUUID())).rejects.toMatchObject({
        status: 404,
        code: "PROJECT_NOT_FOUND",
      });
    });

    it("restores an older version for the project's owner, unless a setup is in progress", async () => {
      const project = await insertProject(db);
      const store = new DbEnvironmentStore(db);
      await store.save(project.id, config("npm ci"), "ai");
      await store.save(project.id, config("npm install"), "ai");
      const restore = (version: string, userId = project.userId) =>
        projects.restoreVersion(
          request(userId, { id: project.id, version }),
          response,
        );

      expect(await restore("1")).toMatchObject({
        status: 200,
        data: {
          environment: {
            version: 1,
            active: true,
            steps: [{ command: "npm ci" }],
          },
        },
      });
      expect(
        await projects.getEnvironments(
          request(project.userId, { id: project.id }),
          response,
        ),
      ).toMatchObject({
        data: {
          environments: [
            { version: 2, active: false },
            { version: 1, active: true },
          ],
        },
      });
      expect(
        await projects.getProject(
          request(project.userId, { id: project.id }),
          response,
        ),
      ).toMatchObject({ data: { project: { environment: { version: 1 } } } });

      await expect(restore("9")).rejects.toMatchObject({
        status: 404,
        code: "ENVIRONMENT_NOT_FOUND",
      });
      await expect(restore("1", randomUUID())).rejects.toMatchObject({
        status: 404,
        code: "PROJECT_NOT_FOUND",
      });
      await expect(restore("one")).rejects.toBeInstanceOf(ZodError);
      await expect(restore("0")).rejects.toBeInstanceOf(ZodError);

      await createOnboarding(db, {
        projectId: project.id,
        userId: project.userId,
      });
      await expect(restore("2")).rejects.toMatchObject({
        status: 409,
        code: "SETUP_IN_PROGRESS",
      });
    });
  });
});
