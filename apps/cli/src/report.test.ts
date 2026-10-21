import type { AgentResult } from "@codegenie/agent";
import type { RunResult, OnboardingResult } from "@codegenie/runner";
import { createStyle, plain } from "@codegenie/terminal";
import { describe, expect, it } from "vitest";
import {
  exitCode,
  formatSetupSummary,
  formatSummary,
  setupExitCode,
} from "./report.js";

const RULE = (title: string) =>
  `◇ ${title} ${"─".repeat(48 - title.length - 3)}`;

describe("formatSummary", () => {
  const agent = {
    status: "succeeded",
    title: "Add GET /health",
    summary: "Added GET /health.",
    steps: 14,
    durationMs: 40_000,
    model: "openai:gpt-6-luna",
    usage: {
      inputTokens: 50_000,
      cachedInputTokens: 40_000,
      outputTokens: 1_000,
      costUsd: 0.0012,
    },
    compactions: 0,
    messages: [],
  } satisfies AgentResult;

  const result: RunResult = {
    status: "succeeded",
    agent,
    verify: {
      checks: [
        {
          name: "lint",
          command: "npm run lint",
          cwd: ".",
          status: "passing",
          durationMs: 1,
          logPath: "/l",
          comparison: "passing",
        },
        {
          name: "typecheck",
          command: "npm run typecheck",
          cwd: ".",
          status: "passing",
          durationMs: 1,
          logPath: "/c",
          comparison: "fixed",
        },
        {
          name: "test",
          command: "npm run test",
          cwd: "api",
          status: "failing",
          durationMs: 1,
          logPath: "/t",
          outputTail: "1 failing",
          comparison: "regressed",
        },
        {
          name: "build",
          command: "npm run build",
          cwd: ".",
          status: "failing",
          durationMs: 1,
          logPath: "/b",
          outputTail: "old error",
          comparison: "still-failing",
        },
      ],
      passed: false,
      fixed: 1,
      regressions: 1,
    },
    diff: {
      patch: "diff --git a/src/app.ts b/src/app.ts\n+route\n",
      truncated: false,
      files: [
        { path: "src/app.ts", added: 3, removed: 0 },
        { path: "logo.png", added: null, removed: null },
      ],
    },
    durationMs: 48_000,
  };

  it("summarizes the summary, checks, diff and stats, then prints the patch", () => {
    expect(formatSummary(result, { style: plain })).toBe(
      [
        "",
        RULE("Result"),
        "│ Added GET /health.",
        "│",
        "│ Checks: lint ✓  typecheck ✓ fixed  test (api) ✗ regressed  build ✗ still failing",
        "│ --- test (api) (npm run test) ---",
        "│ 1 failing",
        "│",
        "│ 2 files changed (+3 −0)",
        "│   src/app.ts  +3 −0",
        "│   logo.png  binary",
        "└ ✓ succeeded · 14 steps · 51.0k tokens (80% cached) · $0.0012 · 48s",
        "",
        "diff --git a/src/app.ts b/src/app.ts\n+route",
      ].join("\n"),
    );
  });

  it("colors comparisons by meaning", () => {
    const colored = formatSummary(result, { style: createStyle(true) });
    expect(colored).toContain("\u001b[31m✗ regressed\u001b[39m");
    expect(colored).toContain("\u001b[33m✗ still failing\u001b[39m");
    expect(colored).toContain("\u001b[32m✓ fixed\u001b[39m");
  });

  it("points to a saved patch instead of printing it, and explains failures", () => {
    const failed: RunResult = {
      status: "failed",
      failedStage: "checkout",
      error: "git clone failed: not found",
      durationMs: 3_000,
    };
    expect(formatSummary(failed, { style: plain })).toBe(
      `\n${RULE("Result")}\n│ Failed at checkout: git clone failed: not found\n└ ✗ failed · 3s`,
    );
    const saved = formatSummary(result, {
      style: plain,
      patchPath: "/tmp/x.patch",
    });
    expect(saved).toContain("│ Patch saved to /tmp/x.patch");
    expect(saved).not.toContain("diff --git");
  });
});

describe("exitCode", () => {
  it("maps run status to process exit codes", () => {
    expect(exitCode("succeeded")).toBe(0);
    expect(exitCode("failed")).toBe(1);
    expect(exitCode("incomplete")).toBe(2);
    expect(exitCode("cancelled")).toBe(130);
  });
});

describe("formatSummary setup details", () => {
  it("shows setup notes and why the environment needs attention", () => {
    const summary = formatSummary(
      {
        status: "succeeded",
        setup: {
          config: {
            version: 1,
            steps: [],
            checks: [],
            meta: { source: "detected", createdAt: "", decisions: [] },
          },
          steps: [
            {
              name: "install",
              cwd: ".",
              command: "npm ci",
              status: "failed",
              durationMs: 1,
              logPath: "/s",
            },
          ],
          baseline: null,
          checks: [],
          health: "needs_attention",
          healthReasons: [
            'Setup step "install" (.) failed: `npm ci`.',
            "admin/ has its own package.json but isn't covered by the environment.",
          ],
          notes: ['Setup step "install" (.) failed: `npm ci`.'],
        },
        durationMs: 1_000,
      },
      { style: plain },
    );
    expect(summary).toContain(
      '│ Note: Setup step "install" (.) failed: `npm ci`.',
    );
    expect(summary).toContain(
      [
        "│ ⚠ The environment needs attention:",
        '│   - Setup step "install" (.) failed: `npm ci`.',
        "│   - admin/ has its own package.json but isn't covered by the environment.",
        "│   Run pnpm agent:setup again to update it.",
      ].join("\n"),
    );
  });
});

describe("setup output", () => {
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costUsd: 0.0123,
  };
  const result = (overrides: Partial<OnboardingResult>): OnboardingResult => ({
    status: "approved",
    agent: null,
    notes: [],
    durationMs: 125_000,
    ...overrides,
  });

  it("summarizes a saved setup with the agent's cost", () => {
    expect(
      formatSetupSummary(
        result({
          agent: {
            status: "succeeded",
            steps: 6,
            usage,
            durationMs: 1,
            model: "m",
            compactions: 0,
            notes: [],
            decisions: [],
          },
        }),
        {
          version: 3,
          file: "/home/me/.codegenie/environments/x.json",
          copy: "/tmp/env.json",
        },
        plain,
      ),
    ).toBe(
      [
        "│",
        "│ Saved as version 3 · /home/me/.codegenie/environments/x.json",
        "│ Copy written to /tmp/env.json",
        "└ ✓ approved · setup agent: 6 steps · $0.0123 · 2m 5s",
      ].join("\n"),
    );
  });

  it("says when nothing was saved, and why setup failed", () => {
    expect(
      formatSetupSummary(result({ status: "discarded" }), null, plain),
    ).toContain("Nothing was saved.");
    expect(
      formatSetupSummary(
        result({ status: "failed", error: "git clone failed" }),
        null,
        plain,
      ),
    ).toContain("Error: git clone failed");
  });

  it.each([
    ["approved", 0],
    ["discarded", 0],
    ["failed", 1],
    ["cancelled", 130],
  ] as const)("exits %s with %i", (status, code) => {
    expect(setupExitCode(status)).toBe(code);
  });
});
