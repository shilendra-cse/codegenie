import type { RunEvent } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { createRunReporter } from "./run-events.js";
import { createStyle, plain } from "./style.js";

const ts = "2026-10-19T00:00:00.000Z";

function report(events: RunEvent[], style = plain) {
  const lines: string[] = [];
  const reporter = createRunReporter((l) => lines.push(l), style);
  for (const event of events) reporter.onEvent(event);
  reporter.flush();
  return lines;
}

describe("createRunReporter", () => {
  it("writes a section per stage, setup results, tool calls, check results and notes", () => {
    const lines = report([
      { type: "stage_changed", runId: "j", ts, stage: "setup" },
      {
        type: "setup_completed",
        runId: "j",
        ts,
        success: false,
        steps: [
          { name: "install", cwd: ".", status: "ok" },
          { name: "install", cwd: "api", status: "failed" },
        ],
        checks: [
          { name: "lint", cwd: ".", status: "passing" },
          { name: "test", cwd: "api", status: "failing" },
          { name: "build", cwd: "." },
        ],
      },
      { type: "stage_changed", runId: "j", ts, stage: "agent" },
      { type: "text_delta", runId: "j", ts, delta: "Reading " },
      { type: "text_delta", runId: "j", ts, delta: "the app." },
      { type: "agent_step", runId: "j", ts, steps: 1, costUsd: 0.001 },
      {
        type: "tool_start",
        runId: "j",
        ts,
        toolCallId: "1",
        toolName: "read_file",
        input: { path: "src/app.ts" },
      },
      {
        type: "tool_end",
        runId: "j",
        ts,
        toolCallId: "1",
        toolName: "read_file",
        output: "1│ code",
      },
      {
        type: "tool_start",
        runId: "j",
        ts,
        toolCallId: "2",
        toolName: "run_checks",
        input: {},
      },
      {
        type: "tool_end",
        runId: "j",
        ts,
        toolCallId: "2",
        toolName: "run_checks",
        output:
          "✓ lint: passed in 1.0s — npm run lint\n✗ test (api): failed (exit 1)\n--- output ---\nboom",
      },
      {
        type: "tool_start",
        runId: "j",
        ts,
        toolCallId: "3",
        toolName: "edit_file",
        input: { path: "x.ts" },
      },
      {
        type: "tool_end",
        runId: "j",
        ts,
        toolCallId: "3",
        toolName: "edit_file",
        output: "Error: oldString not found",
      },
    ]);
    expect(lines).toEqual([
      `◇ Setup ${"─".repeat(40)}`,
      "│ steps: ✓ install   ✗ install (api)",
      "│ checks before: lint ✓ · test (api) ✗ failing · build",
      `◇ Agent ${"─".repeat(40)}`,
      "│ “Reading the app.”",
      "│ ▸ read_file     src/app.ts",
      "│ ▸ run_checks",
      "│   ✓ lint: passed in 1.0s — npm run lint",
      "│   ✗ test (api): failed (exit 1)",
      "│ ▸ edit_file     x.ts",
      "│   ✗ Error: oldString not found",
    ]);
  });

  it("leaves out environment setup's own reports, which it prints itself", () => {
    expect(
      report([
        {
          type: "setup_drafted",
          runId: "j",
          ts,
          projects: [{ cwd: ".", packageManager: "npm" }],
        },
        {
          type: "setup_completed",
          runId: "j",
          ts,
          phase: "first",
          success: true,
          steps: [{ name: "install", cwd: ".", status: "ok" }],
          checks: [],
        },
      ]),
    ).toEqual([]);
  });

  it("colors by meaning when colors are on", () => {
    const [stepsLine] = report(
      [
        {
          type: "setup_completed",
          runId: "j",
          ts,
          success: true,
          steps: [{ name: "install", cwd: ".", status: "ok" }],
          checks: [],
        },
      ],
      createStyle(true),
    );
    expect(stepsLine).toContain("\u001b[32m✓\u001b[39m");
  });
});
