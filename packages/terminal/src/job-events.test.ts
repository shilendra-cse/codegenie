import type { JobEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { createJobReporter } from "./job-events.js";
import { createStyle, plain } from "./style.js";

const ts = "2026-10-19T00:00:00.000Z";

function report(events: JobEvent[], style = plain) {
  const lines: string[] = [];
  const reporter = createJobReporter((l) => lines.push(l), style);
  for (const event of events) reporter.onEvent(event);
  reporter.flush();
  return lines;
}

describe("createJobReporter", () => {
  it("writes a section per stage, setup results, tool calls, check results and notes", () => {
    const lines = report([
      { type: "stage_changed", jobId: "j", ts, stage: "setup" },
      {
        type: "setup_completed",
        jobId: "j",
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
      { type: "stage_changed", jobId: "j", ts, stage: "agent" },
      { type: "text_delta", jobId: "j", ts, delta: "Reading " },
      { type: "text_delta", jobId: "j", ts, delta: "the app." },
      { type: "agent_step", jobId: "j", ts, steps: 1, costUsd: 0.001 },
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
        output: "1│ code",
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
        output:
          "✓ lint: passed in 1.0s — npm run lint\n✗ test (api): failed (exit 1)\n--- output ---\nboom",
      },
      {
        type: "tool_start",
        jobId: "j",
        ts,
        toolCallId: "3",
        toolName: "edit_file",
        input: { path: "x.ts" },
      },
      {
        type: "tool_end",
        jobId: "j",
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

  it("colors by meaning when colors are on", () => {
    const [stepsLine] = report(
      [
        {
          type: "setup_completed",
          jobId: "j",
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
