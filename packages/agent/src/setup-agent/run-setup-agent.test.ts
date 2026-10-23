import { FakeSandbox } from "@codegenie/sandbox/testing";
import type { EnvironmentProposal, TryResult } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { scriptedModel, type ScriptedStep } from "../testing/mock-model.js";
import { runSetupAgent, type RunSetupAgentOptions } from "./run-setup-agent.js";

const drafted: EnvironmentProposal = {
  steps: [{ name: "install", cwd: "server", command: "npm ci" }],
  checks: [{ name: "lint", cwd: "server", command: "npm run lint" }],
};
const fixed: EnvironmentProposal = { steps: drafted.steps, checks: [] };

const result = (status: "passing" | "broken"): TryResult => ({
  steps: [{ ...drafted.steps[0]!, status: "ok", durationMs: 1, logPath: "/s" }],
  checks:
    status === "broken"
      ? [
          {
            ...drafted.checks[0]!,
            status,
            durationMs: 1,
            logPath: "/c",
            outputTail: "sh: 1: eslint: not found",
          },
        ]
      : [],
});

const call = (toolName: string, input: unknown): ScriptedStep => ({
  toolCalls: [{ toolName, input }],
});
const finish = (proposal: EnvironmentProposal, notes: string[] = []) =>
  call("finish_setup", { ...proposal, notes });

function setup(
  script: Parameters<typeof scriptedModel>[0],
  overrides: Partial<RunSetupAgentOptions> = {},
) {
  const { model, resolved } = scriptedModel(script);
  const tried: EnvironmentProposal[] = [];
  const run = () =>
    runSetupAgent({
      runId: "setup-1",
      sandbox: new FakeSandbox({
        "server/package.json": '{"scripts":{"lint":"eslint ."}}',
      }),
      model: resolved,
      initial: {
        proposal: drafted,
        result: result("broken"),
        notes: ["JavaScript/TypeScript projects: server (npm)."],
      },
      tryEnvironment: async (proposal) => {
        tried.push(proposal);
        return result("passing");
      },
      channel: { ask: async () => ({ option: 0 }), info: () => {} },
      ...overrides,
    });
  return { model, tried, run };
}

describe("runSetupAgent", () => {
  it("tries a fix, asks the user, and returns the final setup with notes and decisions", async () => {
    const { tried, run } = setup([
      call("ask_user", {
        question:
          "server has a lint script but eslint isn't installed. What should I do?",
        options: [
          { label: "Don't lint server" },
          { label: "Run eslint with npx" },
        ],
      }),
      call("try_environment", fixed),
      finish(fixed, ["Removed lint (server): eslint is not installed there."]),
    ]);
    const outcome = await run();

    expect(outcome).toMatchObject({
      status: "succeeded",
      proposal: fixed,
      notes: ["Removed lint (server): eslint is not installed there."],
      decisions: [
        {
          question:
            "server has a lint script but eslint isn't installed. What should I do?",
          answer: "Don't lint server",
          auto: false,
        },
      ],
      steps: 3,
    });
    expect(tried).toEqual([fixed]);
  });

  it("doesn't count the time spent waiting for an answer against its time limit", async () => {
    const { run } = setup(
      [
        call("ask_user", {
          question: "Should lint be dropped?",
          options: [{ label: "Drop it" }, { label: "Keep it" }],
        }),
        finish(fixed),
      ],
      {
        limits: { maxWallTimeMs: 200 },
        // Longer than the whole limit: only the agent's own work may count.
        channel: {
          ask: () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ option: 0 }), 400),
            ),
          info: () => {},
        },
      },
    );

    const outcome = await run();

    expect(outcome.status).toBe("succeeded");
    expect(outcome.limitReached).toBeUndefined();
    expect(outcome.proposal).toEqual(fixed);
  });

  it("briefs the model with the repository, the drafted setup and its results", async () => {
    const { model, run } = setup([finish(drafted)]);
    await run();
    const [system, first] = model.doStreamCalls[0]!.prompt;
    expect(JSON.stringify(system)).toContain("You are CodeGenie's setup agent");
    expect(JSON.stringify(system)).toContain("server");
    const brief = JSON.stringify(first);
    expect(brief).toContain("npm run lint");
    expect(brief).toContain("eslint: not found");
    expect(brief).toContain("JavaScript/TypeScript projects: server (npm).");
  });

  it("only offers tools that don't edit the repository", async () => {
    const { model, run } = setup([finish(drafted)]);
    await run();
    expect(model.doStreamCalls[0]!.tools!.map((t) => t.name).sort()).toEqual([
      "ask_user",
      "bash",
      "finish_setup",
      "list_files",
      "read_file",
      "search",
      "try_environment",
    ]);
  });

  it("forces finish_setup when a limit is reached", async () => {
    const { model, run } = setup(
      (i) =>
        i < 2 ? call("list_files", {}) : finish(drafted, ["Ran out of steps."]),
      { limits: { maxSteps: 2 } },
    );
    const outcome = await run();
    expect(outcome.status).toBe("incomplete");
    expect(outcome.proposal).toEqual(drafted);
    expect(model.doStreamCalls.at(-1)!.toolChoice).toEqual({
      type: "tool",
      toolName: "finish_setup",
    });
  });

  it("fails when finish_setup is called with an invalid setup", async () => {
    const { run } = setup([
      call("finish_setup", {
        steps: [],
        checks: [{ name: "deploy" }],
        notes: [],
      }),
    ]);
    const outcome = await run();
    expect(outcome).toMatchObject({
      status: "failed",
      error: "finish_setup was called with an invalid setup.",
      proposal: null,
    });
  });
});
