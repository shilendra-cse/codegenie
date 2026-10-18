import { scriptedModel, type ScriptedStep } from "@codegenie/agent/testing";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { SetupQuestion, UserChannel } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { autoChannel } from "./auto-channel.js";
import { runOnboarding, type RunOnboardingOptions } from "./run-onboarding.js";

const repo = {
  "package.json": JSON.stringify({
    scripts: { lint: "eslint .", test: "node --test" },
  }),
  "package-lock.json": "{}",
};

type Handler = (command: string) => object;

/** Every sandbox gets the repo; handlers[i] answers commands in the i-th sandbox. */
function sandboxes(...handlers: Handler[]) {
  const created: FakeSandbox[] = [];
  const destroyed: string[] = [];
  const createSandbox = async () => {
    const index = created.length;
    const sandbox = new FakeSandbox(repo);
    sandbox.execHandler = (command) =>
      command.includes("git rev-parse HEAD")
        ? { stdout: "c0ffee\n" }
        : (handlers[index] ?? (() => ({})))(command);
    sandbox.destroy = async () => {
      destroyed.push(`sandbox-${index}`);
    };
    created.push(sandbox);
    return sandbox;
  };
  return { createSandbox, created, destroyed };
}

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

function options(
  overrides: Partial<RunOnboardingOptions> & {
    createSandbox: RunOnboardingOptions["createSandbox"];
  },
): RunOnboardingOptions {
  return {
    runId: "onboard-1",
    source: { type: "git", url: "https://github.com/acme/app.git" },
    model: scriptedModel([]).resolved,
    channel: autoChannel(),
    ...overrides,
  };
}

describe("runOnboarding", () => {
  it("saves the drafted setup without the agent when everything works", async () => {
    const { createSandbox, created, destroyed } = sandboxes();
    const info: string[] = [];
    const result = await runOnboarding(
      options({ createSandbox, channel: autoChannel((m) => info.push(m)) }),
    );

    expect(result).toMatchObject({
      status: "approved",
      agent: null,
      config: {
        steps: [{ name: "install", cwd: ".", command: "npm ci" }],
        checks: [{ name: "lint" }, { name: "test" }],
        meta: { source: "detected", commit: "c0ffee", decisions: [] },
      },
    });
    expect(created).toHaveLength(2);
    expect(
      created[1]!.execCalls.some((c) => c.command.includes("npm run test")),
    ).toBe(true);
    expect(destroyed.sort()).toEqual(["sandbox-0", "sandbox-1"]);
    expect(info).toContain("Final check in a fresh sandbox…");
  });

  it("lets the setup agent fix problems, then checks its setup in a fresh sandbox", async () => {
    const { createSandbox, created } = sandboxes(lintBroken, lintBroken);
    const { resolved } = scriptedModel([finishWithoutLint]);
    const result = await runOnboarding(
      options({ createSandbox, model: resolved }),
    );

    expect(result).toMatchObject({
      status: "approved",
      agent: { status: "succeeded" },
      config: {
        checks: [{ name: "test", command: "npm run test" }],
        meta: { source: "ai" },
      },
    });
    expect(result.notes).toContain("Left out lint: eslint isn't installed.");
    expect(
      created[1]!.execCalls.some((c) => c.command.includes("npm run lint")),
    ).toBe(false);
  });

  it("keeps the drafted setup when the agent doesn't finish", async () => {
    const { createSandbox } = sandboxes(lintBroken, lintBroken);
    const { resolved } = scriptedModel(() => ({ error: new Error("down") }));
    const result = await runOnboarding(
      options({ createSandbox, model: resolved }),
    );

    expect(result.status).toBe("approved");
    expect(result.agent).toMatchObject({ status: "failed" });
    expect(
      result.notes.some((n) => n.startsWith("The setup agent didn't finish")),
    ).toBe(true);
    expect(result.config!.checks.map((c) => c.name)).toEqual(["test"]);
    expect(result.notes).toContain(
      'Check "lint" (.) left out: the command could not run in the final check.',
    );
  });

  it("notes checks that behave differently in the fresh sandbox", async () => {
    const { createSandbox } = sandboxes(
      () => ({}),
      (command) => (command.includes("npm run test") ? { exitCode: 1 } : {}),
    );
    const result = await runOnboarding(options({ createSandbox }));
    expect(result.notes).toContain(
      'Check "test" (.) was passing during setup but failing in the final check.',
    );
  });

  it("asks before saving, and reports a discard", async () => {
    const { createSandbox } = sandboxes();
    const asked: SetupQuestion[] = [];
    const channel: UserChannel = {
      ask: async (question) => {
        asked.push(question);
        return { option: 1 };
      },
      info: () => {},
    };
    const result = await runOnboarding(options({ createSandbox, channel }));

    expect(result.status).toBe("discarded");
    expect(result.config).toBeDefined();
    expect(asked).toEqual([
      {
        question: "Save this environment?",
        options: [{ label: "Save" }, { label: "Discard" }],
        allowOther: false,
      },
    ]);
  });

  it("fails cleanly when the repository can't be checked out", async () => {
    const { createSandbox, destroyed } = sandboxes((command) =>
      command.includes("git clone")
        ? { exitCode: 128, stderr: "not found" }
        : {},
    );
    const result = await runOnboarding(options({ createSandbox }));
    expect(result).toMatchObject({
      status: "failed",
      error: "git clone failed: not found",
    });
    expect(destroyed).toEqual(["sandbox-0"]);
  });
});
