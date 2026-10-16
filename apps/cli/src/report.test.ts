import type { AgentResult } from "@codegenie/agent";
import type { JobResult } from "@codegenie/runner";
import type { JobEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { createLiveReporter, exitCode, formatSummary } from "./report.js";

const ts = "2026-10-16T00:00:00.000Z";

describe("createLiveReporter", () => {
  it("prints stages, tool calls, check results and the model's text", () => {
    const lines: string[] = [];
    const live = createLiveReporter((line) => lines.push(line));
    const events: JobEvent[] = [
      { type: "stage_changed", jobId: "j", ts, stage: "setup" },
      {
        type: "setup_completed",
        jobId: "j",
        ts,
        success: true,
        commands: { install: "npm ci", test: "npm run test" },
      },
      { type: "stage_changed", jobId: "j", ts, stage: "agent" },
      { type: "text_delta", jobId: "j", ts, delta: "Reading " },
      { type: "text_delta", jobId: "j", ts, delta: "the app." },
      {
        type: "tool_start",
        jobId: "j",
        ts,
        toolCallId: "1",
        toolName: "read_file",
        input: { path: "src/app.ts" },
      },
      {
        type: "tool_end",
        jobId: "j",
        ts,
        toolCallId: "1",
        toolName: "read_file",
        output: "src/app.ts — lines 1–3",
      },
      {
        type: "tool_start",
        jobId: "j",
        ts,
        toolCallId: "2",
        toolName: "run_checks",
        input: {},
      },
      {
        type: "tool_end",
        jobId: "j",
        ts,
        toolCallId: "2",
        toolName: "run_checks",
        output: "✓ test: passed in 1.0s — npm run test\nAll checks passed.",
      },
      {
        type: "tool_end",
        jobId: "j",
        ts,
        toolCallId: "3",
        toolName: "edit_file",
        output: "Error: oldString was not found in a.ts.",
      },
    ];
    for (const event of events) live.onEvent(event);

    expect(lines).toEqual([
      "→ setup",
      "    install ok · checks: test",
      "→ agent",
      "    💬 Reading the app.",
      "    ▶ read_file src/app.ts",
      "    ▶ run_checks",
      "      ✓ test: passed in 1.0s — npm run test",
      "      ✗ Error: oldString was not found in a.ts.",
    ]);
  });
});

describe("formatSummary", () => {
  const agent = {
    status: "succeeded",
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

  const result: JobResult = {
    status: "succeeded",
    agent,
    verify: [
      {
        name: "lint",
        command: "npm run lint",
        cwd: ".",
        passed: true,
        timedOut: false,
        exitCode: 0,
        durationMs: 1,
        logPath: "/l",
      },
      {
        name: "test",
        command: "npm run test",
        cwd: ".",
        passed: false,
        timedOut: false,
        exitCode: 1,
        durationMs: 1,
        logPath: "/t",
        outputTail: "1 failing",
      },
    ],
    checksPassed: false,
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

  it("summarizes status, cost, checks and the diff", () => {
    expect(formatSummary(result)).toBe(
      [
        "",
        "✓ succeeded in 48s · 14 steps · 51.0k tokens (80% cached) · $0.0012",
        "",
        "Summary: Added GET /health.",
        "",
        "Checks after the agent: lint ✓  test ✗",
        "--- test (npm run test) ---",
        "1 failing",
        "",
        "Diff: 2 files changed (+3 −0)",
        "  src/app.ts  +3 −0",
        "  logo.png  binary",
        "",
        "diff --git a/src/app.ts b/src/app.ts\n+route",
      ].join("\n"),
    );
  });

  it("points to a saved patch instead of printing it, and explains failures", () => {
    const failed: JobResult = {
      status: "failed",
      failedStage: "checkout",
      error: "git clone failed: not found",
      durationMs: 3_000,
    };
    expect(formatSummary(failed)).toBe(
      "\n✗ failed in 3s\nFailed at checkout: git clone failed: not found",
    );
    expect(formatSummary(result, { patchPath: "/tmp/x.patch" })).toContain(
      "Patch saved to /tmp/x.patch",
    );
  });
});

describe("exitCode", () => {
  it("maps job status to process exit codes", () => {
    expect(exitCode("succeeded")).toBe(0);
    expect(exitCode("failed")).toBe(1);
    expect(exitCode("incomplete")).toBe(2);
    expect(exitCode("cancelled")).toBe(130);
  });
});
