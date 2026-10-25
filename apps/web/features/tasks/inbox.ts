import type { RunStage, TaskFilter, TaskListItem } from "@codegenie/shared";
import { failureTitle } from "@/features/runs/outcome";

export type InboxFilter = "all" | "needs_you" | TaskFilter;

const URL_FILTERS: Record<string, InboxFilter> = {
  "needs-you": "needs_you",
  running: "running",
  pr: "pr",
  done: "done",
};

export const parseInboxFilter = (param: string | null | undefined) =>
  (param && URL_FILTERS[param]) || "all";

const STAGES: Record<RunStage, string> = {
  prepare: "Preparing the sandbox",
  checkout: "Preparing the sandbox",
  setup: "Setting up",
  agent: "Working",
  verify: "Running the checks",
  deliver: "Opening the pull request",
};

function checksAndFiles(run: NonNullable<TaskListItem["latestRun"]>) {
  const checks =
    run.checksPassed === null
      ? "No checks"
      : run.checksPassed
        ? "Checks passing"
        : "Checks failing";
  if (run.filesChanged === null) return checks;
  const files = `${run.filesChanged} ${run.filesChanged === 1 ? "file" : "files"} changed`;
  return `${checks} · ${files}`;
}

export function taskDetail(task: TaskListItem): string {
  const run = task.latestRun;
  switch (task.label) {
    case "queued":
      return "Waiting for a sandbox";
    case "working":
      return run?.stage ? STAGES[run.stage] : "Starting";
    case "pr_open":
      return run ? checksAndFiles(run) : "Ready for review";
    case "pr_draft":
      return run?.status === "incomplete"
        ? "Draft: stopped before finishing"
        : "Draft: checks still failing";
    case "merged":
      return `Merged into ${task.baseBranch}`;
    case "closed":
      return "Closed without merging";
    case "no_changes":
      return run?.summaryLine ?? "No changes needed";
    case "failed":
      return failureTitle(run?.error?.code);
    case "cancelled":
      return "You cancelled this task";
  }
}

export type DayGroup<T> = { label: string; items: T[] };

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

function dayLabel(created: Date, now: Date) {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (created >= today) return "Today";
  if (created >= yesterday) return "Yesterday";
  if (created >= monday) return "Earlier this week";
  return "Earlier";
}

export function groupByDay<T extends { createdAt: string }>(
  items: T[],
  now: Date,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const label = dayLabel(new Date(item.createdAt), now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
