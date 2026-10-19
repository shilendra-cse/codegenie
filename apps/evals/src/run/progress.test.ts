import { PassThrough } from "node:stream";
import { plain } from "@codegenie/terminal";
import { describe, expect, it } from "vitest";
import { EvalProgress, reason } from "./progress.js";
import type { TaskResult } from "./run-task.js";

const result = (overrides: Partial<TaskResult>): TaskResult => ({
  id: "ts-lib/paginate-bug",
  attempt: 1,
  solved: true,
  grade: { passed: true, detail: "Hidden tests passed." },
  job: { status: "succeeded" },
  checks: { fixed: 0, regressions: 0, failing: 0 },
  agent: { status: "succeeded", steps: 9, costUsd: 0.0041, summary: null },
  durationMs: 95_000,
  ...overrides,
});

function setup() {
  const out = new PassThrough();
  let written = "";
  out.on("data", (chunk: Buffer) => (written += chunk.toString()));
  let now = 0;
  const progress = new EvalProgress(out, {
    total: 2,
    nameWidth: 19,
    style: plain,
    now: () => now,
  });
  return {
    progress,
    lines: () => written.trimEnd().split("\n"),
    advance: (ms: number) => (now += ms),
  };
}

const ts = "";

describe("EvalProgress outside a terminal", () => {
  it("prints starts, stage changes, a heartbeat while the agent works, and results", () => {
    const { progress, lines, advance } = setup();
    progress.taskStarted(
      "ts-lib/paginate-bug",
      `${process.cwd()}/results/run/ts-lib--paginate-bug-1.log`,
    );
    progress.taskEvent("ts-lib/paginate-bug", {
      type: "stage_changed",
      jobId: "j",
      ts,
      stage: "setup",
    });
    progress.taskEvent("ts-lib/paginate-bug", {
      type: "stage_changed",
      jobId: "j",
      ts,
      stage: "agent",
    });
    progress.taskEvent("ts-lib/paginate-bug", {
      type: "agent_step",
      jobId: "j",
      ts,
      steps: 4,
      costUsd: 0.002,
    });
    advance(31_000);
    (progress as unknown as { beat: () => void }).beat();
    progress.taskFinished("ts-lib/paginate-bug", result({}));
    progress.taskFinished(
      "http-api/health",
      result({
        id: "http-api/health",
        solved: false,
        grade: { passed: false, detail: "Hidden tests failed:\n✖ GET /health" },
        durationMs: 130_000,
        agent: {
          status: "succeeded",
          steps: 12,
          costUsd: 0.0062,
          summary: null,
        },
      }),
    );

    expect(lines()).toEqual([
      "▶ ts-lib/paginate-bug  log: results/run/ts-lib--paginate-bug-1.log",
      "  ts-lib/paginate-bug  setup",
      "  ts-lib/paginate-bug  agent",
      "  ts-lib/paginate-bug  agent · 4 steps · $0.0020 · 0:31",
      "✓ ts-lib/paginate-bug   1m 35s  $0.0041",
      "✗ http-api/health       2m 10s  $0.0062  hidden tests failed",
    ]);
  });

  it("shows onboarding as an activity", () => {
    const { progress, lines } = setup();
    progress.info("Onboarding dodesk…");
    const done = progress.activity("dodesk", "onboarding");
    done();
    expect(lines()).toEqual([
      "Onboarding dodesk…",
      "  dodesk               onboarding",
    ]);
  });
});

describe("reason", () => {
  it("says why a task wasn't solved", () => {
    expect(
      reason(
        result({
          solved: false,
          agent: null,
          job: { status: "failed", failedStage: "setup" },
        }),
      ),
    ).toBe("failed at setup");
    expect(
      reason(
        result({
          solved: false,
          checks: { fixed: 0, regressions: 2, failing: 2 },
        }),
      ),
    ).toBe("2 checks regressed");
    expect(
      reason(
        result({
          solved: false,
          grade: { passed: false, detail: "typecheck@server: failing" },
        }),
      ),
    ).toBe("typecheck@server: failing");
  });
});
