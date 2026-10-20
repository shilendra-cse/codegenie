import { scriptedModel, type ScriptedStep } from "@codegenie/agent/testing";
import { DbEnvironmentStore, type Db } from "@codegenie/db";
import { insertProject, testDatabaseOrSkip } from "@codegenie/db/testing";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { OnboardingMessage } from "@codegenie/shared";
import { afterAll, describe, expect, it } from "vitest";
import type { Publisher } from "../events/sink.js";
import {
  handleOnboardProject,
  type OnboardProjectDeps,
} from "./onboard-project.js";

const database = await testDatabaseOrSkip("onboard-project handler");

type Handler = (command: string) => object;

const lintBroken: Handler = (command) =>
  command.includes("npm run lint")
    ? { exitCode: 127, stdout: "sh: 1: eslint: not found" }
    : {};

const finishWithoutLint: ScriptedStep = {
  toolCalls: [
    {
      toolName: "finish_setup",
      input: {
        steps: [{ name: "install", cwd: ".", command: "npm ci" }],
        checks: [{ name: "test", cwd: ".", command: "npm run test" }],
        notes: ["Left out lint: eslint isn't installed."],
      },
    },
  ],
};

function createSandbox(handler: Handler = () => ({})) {
  return async () => {
    const sandbox = new FakeSandbox({
      "package.json": JSON.stringify({
        scripts: { lint: "eslint .", test: "node --test" },
      }),
      "package-lock.json": "{}",
    });
    sandbox.execHandler = (command) =>
      command.includes("git rev-parse HEAD")
        ? { stdout: "c0ffee\n" }
        : handler(command);
    return sandbox;
  };
}

describe.skipIf(!database)("onboard-project handler against Postgres", () => {
  const db = database?.db as Db;
  const environments = new DbEnvironmentStore(db);
  afterAll(() => database?.drop());

  function depsFor(handler?: Handler, script: ScriptedStep[] = []) {
    const published: { channel: string; message: OnboardingMessage }[] = [];
    const publisher: Publisher = {
      async publish(channel, message) {
        published.push({
          channel,
          message: JSON.parse(message) as OnboardingMessage,
        });
        return 1;
      },
    };
    const deps: OnboardProjectDeps = {
      db,
      publisher,
      log: () => {},
      model: scriptedModel(script).resolved,
      createSandbox: createSandbox(handler),
    };
    return { deps, published, messages: () => published.map((p) => p.message) };
  }

  it("saves the drafted environment and publishes its progress", async () => {
    const project = await insertProject(db);
    const { deps, published, messages } = depsFor();

    const result = await handleOnboardProject(deps, { projectId: project.id });

    expect(result.status).toBe("approved");
    expect(await environments.load(project.id)).toMatchObject({
      version: 1,
      source: "detected",
      config: { meta: { commit: "c0ffee" } },
    });
    expect(new Set(published.map((p) => p.channel))).toEqual(
      new Set([`project:${project.id}:onboarding`]),
    );
    expect(messages()).toContainEqual({
      type: "info",
      message: "Final check in a fresh sandbox…",
    });
    expect(messages().at(-1)).toEqual({
      type: "done",
      status: "approved",
      version: 1,
    });
  });

  it("saves a new version when the project is onboarded again", async () => {
    const project = await insertProject(db);
    await handleOnboardProject(depsFor().deps, { projectId: project.id });

    const { deps, messages } = depsFor();
    await handleOnboardProject(deps, { projectId: project.id });

    expect((await environments.load(project.id))?.version).toBe(2);
    expect((await environments.list(project.id)).map((e) => e.version)).toEqual(
      [2, 1],
    );
    expect(messages().at(-1)).toMatchObject({ type: "done", version: 2 });
  });

  it("publishes the setup agent's events when the draft has problems", async () => {
    const project = await insertProject(db);
    const { deps, messages } = depsFor(lintBroken, [finishWithoutLint]);

    await handleOnboardProject(deps, { projectId: project.id });

    expect(messages()).toContainEqual({
      type: "event",
      event: expect.objectContaining({
        type: "tool_start",
        runId: `onboard-${project.id}`,
      }),
    });
    expect(await environments.load(project.id)).toMatchObject({
      source: "ai",
    });
  });

  it("throws when onboarding fails, without saving anything", async () => {
    const project = await insertProject(db);
    const { deps, messages } = depsFor((command) =>
      command.includes("git clone")
        ? { exitCode: 128, stderr: "repository not found" }
        : {},
    );

    await expect(
      handleOnboardProject(deps, { projectId: project.id }),
    ).rejects.toThrow("Onboarding acme/app failed");

    expect(await environments.load(project.id)).toBeNull();
    expect(messages().at(-1)).toMatchObject({
      type: "done",
      status: "failed",
      error: expect.any(String),
    });
  });

  it("throws for a project that doesn't exist", async () => {
    const { deps, published } = depsFor();
    const projectId = "00000000-0000-0000-0000-000000000000";

    await expect(handleOnboardProject(deps, { projectId })).rejects.toThrow(
      `Project ${projectId} doesn't exist.`,
    );
    expect(published).toEqual([]);
  });
});
