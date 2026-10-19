import { describe, expect, it } from "vitest";
import { formatReport } from "./report.js";
import type { TaskResult } from "./run/run-task.js";

const result = (overrides: Partial<TaskResult>): TaskResult => ({
  id: "ts-lib-paginate-bug",
  attempt: 1,
  solved: true,
  grade: { passed: true, detail: "Hidden tests passed." },
  job: { status: "succeeded" },
  checks: { fixed: 0, regressions: 0, failing: 0 },
  agent: {
    status: "succeeded",
    steps: 9,
    costUsd: 0.0042,
    summary: "Fixed it.",
  },
  durationMs: 130_000,
  ...overrides,
});

describe("formatReport", () => {
  it("tabulates results with totals and details for what wasn't solved", () => {
    const report = formatReport(
      [
        result({}),
        result({
          id: "http-api-health",
          solved: false,
          grade: {
            passed: false,
            detail: "Hidden tests failed:\n✖ GET /health",
          },
          checks: { fixed: 0, regressions: 1, failing: 1 },
          agent: {
            status: "incomplete",
            steps: 40,
            costUsd: 0.01,
            summary: "Ran out of steps.",
          },
          durationMs: 45_000,
          diffFile: "/r/run-1/http-api-health-1.patch",
        }),
        result({
          id: "buyerbook-phone",
          solved: null,
          grade: { passed: null, detail: "Needs a manual review of the diff." },
        }),
      ],
      {
        model: "openai:gpt-6-luna",
        startedAt: new Date("2026-10-19T09:30:00Z"),
        durationMs: 300_000,
        resultsDir: "/r/run-1",
      },
    );
    expect(report).toContain(
      "# Eval run · 2026-10-19 09:30 · openai:gpt-6-luna",
    );
    expect(report).toContain(
      "| ts-lib-paginate-bug | ✓ | succeeded | all passing | 9 | 2m 10s | $0.0042 |",
    );
    expect(report).toContain(
      "| http-api-health | ✗ | incomplete | 1 regressed, 1 failing | 40 | 45s | $0.0100 |",
    );
    expect(report).toContain("| buyerbook-phone | review |");
    expect(report).toContain(
      "**Solved 1 of 2** (1 to review) · $0.0184 · 5m 0s",
    );
    expect(report).toContain(
      "### http-api-health\n\n```\nHidden tests failed:\n✖ GET /health\n```",
    );
    expect(report).toContain("Agent summary: Ran out of steps.");
    expect(report).toContain("Diff: http-api-health-1.patch");
  });

  it("numbers repeated attempts and shows jobs that failed before the agent", () => {
    const report = formatReport(
      [
        result({ attempt: 1 }),
        result({
          attempt: 2,
          solved: false,
          agent: null,
          checks: null,
          job: { status: "failed", failedStage: "setup", error: "boom" },
        }),
      ],
      {
        model: "m",
        startedAt: new Date(0),
        durationMs: 1000,
        resultsDir: "/r",
      },
    );
    expect(report).toContain("| ts-lib-paginate-bug #1 | ✓ |");
    expect(report).toContain(
      "| ts-lib-paginate-bug #2 | ✗ | failed at setup | — | — |",
    );
    expect(report).toContain("Job error: boom");
  });
});
