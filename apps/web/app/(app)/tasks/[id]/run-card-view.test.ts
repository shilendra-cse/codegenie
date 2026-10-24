import type { RunEvent, RunResponse } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { buildRunView } from "@/features/runs/run-view";
import { runTotals, toRunCard } from "./run-card-view";

const ts = (second: number) =>
  new Date(Date.UTC(2026, 9, 24, 10, 0, second)).toISOString();
const now = Date.UTC(2026, 9, 24, 10, 1, 0);

const record = (overrides: Partial<RunResponse> = {}): RunResponse => ({
  id: "r1",
  taskId: "t1",
  trigger: "initial",
  status: "running",
  stage: "agent",
  model: "m",
  summary: null,
  checksPassed: null,
  commitSha: null,
  error: null,
  steps: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  queuedAt: ts(0),
  startedAt: ts(0),
  finishedAt: null,
  durationMs: null,
  changes: null,
  ...overrides,
});

const live = { reasoning: "Thinking", steps: null, costUsd: null };

type Event = RunEvent extends infer T
  ? T extends unknown
    ? Omit<T, "runId" | "ts"> & { ts?: string }
    : never
  : never;

function card(events: Event[], run = record()) {
  return toRunCard({
    run,
    number: 1,
    view: buildRunView(
      events.map((e) => ({ ts: ts(0), ...e, runId: "r1" }) as RunEvent),
    ),
    live,
    baseBranch: "main",
    pullRequest: null,
    now,
  });
}

const stage = (result: ReturnType<typeof card>, id: string) =>
  result.stages.find((s) => s.id === id)!;

describe("toRunCard", () => {
  it("says what each stage does before it starts", () => {
    const result = card([]);
    expect(result.stages.map((s) => [s.name, s.state, s.summary])).toEqual([
      ["Prepare", "pending", null],
      ["Set up", "pending", "install and run the checks, for a baseline"],
      ["Working", "pending", "the agent makes the change"],
      ["Checks", "pending", "run again and compared with before"],
      [
        "Pull request",
        "pending",
        "on a new branch, ready or draft depending on the checks",
      ],
    ]);
  });

  it("times a finished stage, and a running one up to now", () => {
    const result = card([
      { type: "stage_changed", stage: "prepare", ts: ts(0) },
      { type: "stage_changed", stage: "agent", ts: ts(18) },
    ]);
    expect(stage(result, "prepare").durationMs).toBe(18_000);
    expect(stage(result, "working").durationMs).toBe(42_000);
  });

  it("compares the checks after the agent's work with before", () => {
    const result = card(
      [
        { type: "stage_changed", stage: "verify", ts: ts(0) },
        {
          type: "checks_completed",
          ts: ts(1),
          passed: false,
          checks: [
            {
              name: "lint",
              cwd: ".",
              command: "x",
              status: "failing",
              comparison: "regressed",
            },
            {
              name: "test",
              cwd: ".",
              command: "y",
              status: "passing",
              comparison: "fixed",
            },
          ],
        },
        { type: "done", status: "succeeded", ts: ts(2) },
      ],
      record({ status: "succeeded" }),
    );
    expect(stage(result, "checks").summary).toBe(
      "1 of 2 checks passing · 1 fixed · 1 broken by this change",
    );
    expect(stage(result, "pr")).toMatchObject({
      state: "skipped",
      summary: "No pull request",
    });
  });

  it("says when setup needs attention, without calling it a failure", () => {
    const result = card([
      { type: "stage_changed", stage: "setup" },
      {
        type: "setup_completed",
        success: false,
        steps: [],
        checks: [{ name: "test", cwd: ".", status: "failing" }],
      },
      { type: "stage_changed", stage: "agent" },
    ]);
    expect(stage(result, "setup")).toMatchObject({
      state: "done",
      summary: "needs attention · before: 0 of 1 check passing",
    });
  });

  it("shows the reasoning and the beam only while the run goes on", () => {
    expect(card([])).toMatchObject({
      live: true,
      reasoning: "Thinking",
      outcome: null,
    });
    const ended = card(
      [],
      record({ status: "succeeded", summary: "Done it." }),
    );
    expect(ended).toMatchObject({
      live: false,
      reasoning: "",
      outcome: { text: "Done it.", failed: false },
    });
  });

  it("says why a run failed", () => {
    expect(
      card(
        [],
        record({
          status: "failed",
          error: { code: "setup_failed", message: "Install failed." },
        }),
      ).outcome,
    ).toEqual({ text: "Install failed.", failed: true, pullRequest: null });
  });

  it("waits at Prepare while queued, timed from when it was queued", () => {
    const result = card([], record({ status: "queued", startedAt: null }));
    expect(stage(result, "prepare")).toMatchObject({
      state: "running",
      summary: "Waiting for a sandbox",
      durationMs: 60_000,
    });
    expect(result.meta).toBe("queued");
  });
});

describe("runTotals", () => {
  it("counts up while running, and uses the run's totals once ended", () => {
    expect(runTotals(record(), { ...live, costUsd: 0.03 }, now)).toBe(
      "1m 00s · $0.03",
    );
    expect(
      runTotals(record({ durationMs: 92_000, costUsd: 0.04 }), live, now),
    ).toBe("1m 32s · $0.04");
  });
});
