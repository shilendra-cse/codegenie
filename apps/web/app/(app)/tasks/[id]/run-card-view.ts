import type { RunDiff, RunResponse } from "@codegenie/shared";
import type { RunCardProps } from "@/components/organisms/run-card";
import type { PanelChanges } from "@/components/organisms/run-panel";
import { splitPatch } from "@/features/runs/diff";
import type { RunLive } from "@/features/runs/use-run-events";
import type { RunView, StageId, StageView } from "@/features/runs/run-view";
import { formatDuration } from "@/lib/format";

const NAMES: Record<StageId, string> = {
  prepare: "Prepare",
  setup: "Set up",
  working: "Working",
  checks: "Checks",
  pr: "Pull request",
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function checksBefore(view: RunView) {
  const before = view.checks.filter((c) => c.before !== null);
  if (before.length === 0) return "no checks to compare";
  const passing = before.filter((c) => c.before === "passing").length;
  return `before: ${passing} of ${plural(before.length, "check")} passing`;
}

function checksAfter(view: RunView) {
  const after = view.checks.filter((c) => c.after !== null);
  if (after.length === 0) return "no checks to run";
  const broken = after.filter((c) => c.comparison === "regressed").length;
  const fixed = after.filter((c) => c.comparison === "fixed").length;
  const passing = after.filter((c) => c.after === "passing").length;
  return [
    `${passing} of ${plural(after.length, "check")} passing`,
    fixed > 0 && `${fixed} fixed`,
    broken > 0 && `${broken} broken by this change`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function summary(
  stage: StageView,
  view: RunView,
  {
    baseBranch,
    steps,
    queued,
    checksPassed,
  }: {
    baseBranch: string;
    steps: number | null;
    queued: boolean;
    checksPassed: boolean | null;
  },
): string | null {
  const { state } = stage;
  switch (stage.id) {
    case "prepare":
      if (queued) return "Waiting for a sandbox";
      return state === "done"
        ? `Sandbox ready, cloned ${baseBranch}`
        : state === "running"
          ? `Preparing a sandbox and cloning ${baseBranch}`
          : null;
    case "setup":
      if (state === "pending")
        return "install and run the checks, for a baseline";
      if (state === "running") return "Installing and running the checks";
      return view.setupOk === false
        ? `needs attention · ${checksBefore(view)}`
        : checksBefore(view);
    case "working":
      if (state === "pending") return "the agent makes the change";
      return steps !== null ? plural(steps, "step") : null;
    case "checks":
      if (state === "pending") return "run again and compared with before";
      if (state === "running") return "Running the checks again";
      if (view.checksDone) return checksAfter(view);
      // Runs from before checks_completed existed only kept whether they all passed.
      return checksPassed === null
        ? null
        : checksPassed
          ? "all passing"
          : "some failing";
    case "pr":
      if (view.pullRequest) {
        return `${view.pullRequest.draft ? "Draft" : "Opened"} PR #${view.pullRequest.number}`;
      }
      if (state === "pending")
        return "on a new branch, ready or draft depending on the checks";
      if (state === "running") return "Committing and opening the pull request";
      return state === "skipped" ? "No pull request" : null;
  }
}

function outcome(
  run: RunResponse,
  view: RunView,
  pullRequest: { number: number; url: string } | null,
): RunCardProps["outcome"] {
  switch (run.status) {
    case "queued":
    case "running":
      return null;
    case "failed":
      return {
        text: run.error?.message ?? view.error ?? "The run failed.",
        failed: true,
        pullRequest: null,
      };
    case "cancelled":
      return {
        text: "The run was cancelled. Nothing was pushed.",
        failed: false,
        pullRequest: null,
      };
    default:
      return {
        text: run.summary ?? "Done.",
        failed: false,
        pullRequest,
      };
  }
}

/** The run card's content: the run's record plus what its events say. */
export function toRunCard({
  run,
  number,
  view,
  live,
  baseBranch,
  pullRequest,
  now,
}: {
  run: RunResponse;
  number: number;
  view: RunView;
  live: RunLive;
  baseBranch: string;
  pullRequest: { number: number; url: string } | null;
  now: number;
}): RunCardProps {
  const active = run.status === "queued" || run.status === "running";
  const queued = run.status === "queued";
  const steps = live.steps ?? (run.steps > 0 ? run.steps : null);
  const cost = live.costUsd ?? (run.costUsd > 0 ? run.costUsd : null);
  return {
    number,
    live: active,
    meta: queued
      ? "queued"
      : [
          steps !== null && `step ${steps}`,
          cost !== null && `$${cost.toFixed(2)}`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    stages: view.stages.map((stage) => ({
      id: stage.id,
      name: NAMES[stage.id],
      // Before its first event a queued run is still waiting at Prepare.
      state: queued && stage.id === "prepare" ? "running" : stage.state,
      summary: summary(stage, view, {
        baseBranch,
        steps,
        queued,
        checksPassed: run.checksPassed,
      }),
      durationMs: stage.startedAt
        ? (stage.endedAt ? Date.parse(stage.endedAt) : now) -
          Date.parse(stage.startedAt)
        : queued && stage.id === "prepare"
          ? now - Date.parse(run.queuedAt)
          : null,
    })),
    activity: view.activity,
    reasoning: active ? live.reasoning : "",
    outcome: outcome(run, view, pullRequest),
  };
}

/** "4m 12s · $0.08" for the top bar. */
export function runTotals(run: RunResponse, live: RunLive, now: number) {
  const elapsed =
    run.durationMs ?? (run.startedAt ? now - Date.parse(run.startedAt) : null);
  const cost = live.costUsd ?? run.costUsd;
  return [
    elapsed !== null && formatDuration(elapsed),
    cost > 0 && `$${cost.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The Changes tab: the files counted from the agent's edits while it runs, the saved diff after. */
export function toPanelChanges({
  active,
  view,
  diff,
  file,
}: {
  active: boolean;
  view: RunView;
  diff: {
    data: RunDiff | null | undefined;
    isError: boolean;
    refetch: () => unknown;
  };
  file: string | null;
}): PanelChanges {
  if (active) return { status: "live", files: view.files };
  if (diff.isError)
    return { status: "error", onRetry: () => void diff.refetch() };
  if (diff.data === undefined) return { status: "loading" };
  if (diff.data === null) {
    return { status: "ended", files: [], lines: null, truncated: false };
  }
  const files = diff.data.files;
  const path =
    file && files.some((f) => f.path === file) ? file : files[0]?.path;
  return {
    status: "ended",
    files,
    lines: path ? (splitPatch(diff.data.patch).get(path) ?? []) : null,
    truncated: diff.data.truncated,
  };
}
