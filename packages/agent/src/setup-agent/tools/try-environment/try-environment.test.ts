import type { EnvironmentProposal } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import type { SetupToolContext } from "../../context.js";
import { tryEnvironment } from "./try-environment.js";

describe("try_environment", () => {
  it("runs the setup through the runner and reports statuses with output", async () => {
    const tried: EnvironmentProposal[] = [];
    const ctx: SetupToolContext = {
      tryEnvironment: async (proposal) => {
        tried.push(proposal);
        return {
          steps: [
            {
              ...proposal.steps[0]!,
              status: "ok",
              durationMs: 12_000,
              logPath: "/l/1",
            },
          ],
          checks: [
            {
              ...proposal.checks[0]!,
              status: "passing",
              durationMs: 2_000,
              logPath: "/l/2",
            },
            {
              ...proposal.checks[1]!,
              status: "failing",
              durationMs: 3_000,
              logPath: "/l/3",
              outputTail: "connect ECONNREFUSED 127.0.0.1:5432",
            },
          ],
        };
      },
      channel: { ask: async () => ({ option: 0 }), info: () => {} },
      questionsAsked: 0,
      decisions: [],
    };
    const proposal = {
      steps: [{ name: "install", cwd: "api", command: "npm ci" }],
      checks: [
        { name: "lint" as const, cwd: "api", command: "npm run lint" },
        { name: "test" as const, cwd: "api", command: "npm run test" },
      ],
    };

    expect(await tryEnvironment(ctx, proposal)).toBe(
      [
        "Steps:",
        "✓ install (api): npm ci (12.0s)",
        "",
        "Checks:",
        "✓ passing lint (api): npm run lint (2.0s)",
        "✗ failing test (api): npm run test (3.0s), full log: /l/3",
        "    connect ECONNREFUSED 127.0.0.1:5432",
      ].join("\n"),
    );
    expect(tried).toEqual([proposal]);
  });
});
