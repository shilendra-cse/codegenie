import type { TaskListItem } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { groupByDay, parseInboxFilter, taskDetail } from "./inbox";

type Run = NonNullable<TaskListItem["latestRun"]>;

const task = (
  label: TaskListItem["label"],
  run: Partial<Run> = {},
): TaskListItem => ({
  id: "t1",
  title: "Add a /health endpoint",
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label,
  baseBranch: "main",
  branchName: null,
  pullRequest: null,
  latestRun: {
    id: "r1",
    status: "succeeded",
    stage: null,
    error: null,
    checksPassed: null,
    filesChanged: null,
    summaryLine: null,
    ...run,
  },
  runCount: 1,
  durationMs: 0,
  costUsd: 0,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
});

describe("taskDetail", () => {
  it.each([
    ["queued", task("queued"), "Waiting for a sandbox"],
    ["working, not started", task("working"), "Starting"],
    [
      "preparing",
      task("working", { stage: "checkout" }),
      "Preparing the sandbox",
    ],
    ["setting up", task("working", { stage: "setup" }), "Setting up"],
    ["working", task("working", { stage: "agent" }), "Working"],
    ["checking", task("working", { stage: "verify" }), "Running the checks"],
    [
      "delivering",
      task("working", { stage: "deliver" }),
      "Opening the pull request",
    ],
    [
      "a PR with passing checks",
      task("pr_open", { checksPassed: true, filesChanged: 4 }),
      "Checks passing · 4 files changed",
    ],
    [
      "a PR with one file and failing checks",
      task("pr_open", { checksPassed: false, filesChanged: 1 }),
      "Checks failing · 1 file changed",
    ],
    ["a PR without checks or a diff", task("pr_open"), "No checks"],
    [
      "a draft that stopped",
      task("pr_draft", { status: "incomplete" }),
      "Draft: stopped before finishing",
    ],
    [
      "a draft with failing checks",
      task("pr_draft"),
      "Draft: checks still failing",
    ],
    ["merged", task("merged"), "Merged into main"],
    ["closed", task("closed"), "Closed without merging"],
    [
      "no changes",
      task("no_changes", { summaryLine: "Already renamed in 4f2c1a9." }),
      "Already renamed in 4f2c1a9.",
    ],
    ["no changes, no summary", task("no_changes"), "No changes needed"],
    [
      "failed",
      task("failed", {
        status: "failed",
        error: { code: "setup_failed", message: null },
      }),
      "Failed during setup",
    ],
    [
      "failed, unknown why",
      task("failed", { status: "failed" }),
      "The run failed",
    ],
    ["cancelled", task("cancelled"), "You cancelled this task"],
  ])("says what a task is doing or how it ended: %s", (_case, item, detail) => {
    expect(taskDetail(item)).toBe(detail);
  });
});

describe("groupByDay", () => {
  // Wednesday 2026-10-28, mid-afternoon, local time.
  const now = new Date(2026, 9, 28, 15, 0);
  const at = (day: number, hour = 9) => ({
    createdAt: new Date(2026, 9, day, hour).toISOString(),
  });

  it("groups by the day it started, keeping the order", () => {
    const items = [at(28, 14), at(28, 0), at(27, 23), at(26), at(25), at(1)];

    expect(groupByDay(items, now)).toEqual([
      { label: "Today", items: [items[0], items[1]] },
      { label: "Yesterday", items: [items[2]] },
      { label: "Earlier this week", items: [items[3]] },
      { label: "Earlier", items: [items[4], items[5]] },
    ]);
  });

  it("leaves out days with nothing", () => {
    expect(groupByDay([at(20)], now)).toEqual([
      { label: "Earlier", items: [at(20)] },
    ]);
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("parseInboxFilter", () => {
  it.each([
    ["needs-you", "needs_you"],
    ["running", "running"],
    ["pr", "pr"],
    ["done", "done"],
    ["everything", "all"],
    [null, "all"],
  ])("reads ?filter=%s", (param, filter) => {
    expect(parseInboxFilter(param)).toBe(filter);
  });
});
