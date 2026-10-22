import { randomUUID } from "node:crypto";
import { type Db, DbEnvironmentStore } from "@codegenie/db";
import { insertProject, testDatabaseOrSkip } from "@codegenie/db/testing";
import type { Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http-error";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createProjectControllers } from "./projects.controller";

const database = await testDatabaseOrSkip("project controllers");

describe.skipIf(!database)("project controllers against Postgres", () => {
  const db = database?.db as Db;
  const projects = createProjectControllers({ db });
  afterAll(() => database?.drop());

  const request = (userId: string, params: Record<string, string> = {}) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
      params,
    }) as unknown as AuthenticatedRequest;
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
              accountLogin: "acme",
              suspended: false,
              uninstalled: false,
            },
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
      data: { project: { id: project.id, environment: null } },
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
});
