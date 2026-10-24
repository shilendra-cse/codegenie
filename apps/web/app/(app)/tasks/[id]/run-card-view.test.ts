import type { RunEvent, RunResponse } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { buildRunView } from "@/features/runs/run-view";
import { runOutcome } from "@/features/runs/outcome";
import { runTotals, toRunCard, toRunResult } from "./run-card-view";

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

  it("falls back to whether the checks passed for a run that didn't record each one", () => {
    const result = card(
      [
        { type: "stage_changed", stage: "verify", ts: ts(0) },
        { type: "done", status: "succeeded", ts: ts(1) },
      ],
      record({ status: "succeeded", checksPassed: true }),
    );
    expect(stage(result, "checks").summary).toBe("all passing");
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
    expect(card([])).toMatchObject({ live: true, reasoning: "Thinking" });
    expect(card([], record({ status: "succeeded" }))).toMatchObject({
      live: false,
      reasoning: "",
    });
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

describe("toRunResult", () => {
  const ended = record({
    status: "succeeded",
    summary: "Added GET /health.",
    checksPassed: true,
    finishedAt: ts(0),
  });
  const result = (events: Event[], run: RunResponse = ended) => {
    const view = buildRunView(
      events.map((e) => ({ ts: ts(0), ...e, runId: "r1" }) as RunEvent),
    );
    const outcome = runOutcome({
      task: {
        label: "pr_open",
        pullRequest: {
          number: 7,
          url: "https://github.com/x/y/pull/7",
          draft: false,
        },
        project: { id: "p1", owner: "ada", name: "dodesk" },
        baseBranch: "main",
      },
      run,
      title: "Add a /health endpoint",
      checksDone: view.checksDone,
    })!;
    return toRunResult({ outcome, run, number: 1, view, now });
  };

  it("shows each check before and after when the run recorded them", () => {
    const shown = result([
      {
        type: "setup_completed",
        success: true,
        steps: [],
        checks: [{ name: "test", cwd: ".", status: "failing" }],
      },
      {
        type: "checks_completed",
        passed: true,
        checks: [
          {
            name: "test",
            cwd: ".",
            command: "pnpm test",
            status: "passing",
            comparison: "fixed",
          },
        ],
      },
    ]);
    expect(shown).toMatchObject({
      number: 1,
      time: "1 minute ago",
      summary: "Added GET /health.",
      checks: [
        {
          name: "test",
          before: "failing",
          after: "passing",
          comparison: "fixed",
        },
      ],
      checksLine: null,
      pullRequest: { number: 7, title: "Add a /health endpoint" },
    });
  });

  it("says only whether all checks passed for runs that didn't record each one", () => {
    expect(result([])).toMatchObject({
      checks: null,
      checksLine: "All checks passed.",
    });
    expect(result([], { ...ended, checksPassed: false })).toMatchObject({
      checksLine: "Some checks failed.",
    });
  });
});
