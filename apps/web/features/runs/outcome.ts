import type { RunResponse, TaskDetail } from "@codegenie/shared";
import { formatDuration } from "@/lib/format";
import { environmentPath, projectPath } from "@/lib/routes";

export type OutcomeState =
  | "pr_ready"
  | "pr_draft"
  | "merged"
  | "closed"
  | "no_changes"
  | "incomplete"
  | "failed"
  | "cancelled";

export type OutcomeTone = "neutral" | "ok" | "warn" | "err" | "merged";

export type OutcomeNotice = {
  tone: "warn" | "err" | "neutral";
  title: string;
  text: string | null;
  /** A line under the text, e.g. what was or wasn't pushed. */
  note: string | null;
  action: { label: string; href: string } | null;
};

export type RunOutcome = {
  state: OutcomeState;
  /** The run card's badge. */
  status: { label: string; tone: OutcomeTone };
  notice: OutcomeNotice | null;
  summary: string | null;
  showsChecks: boolean;
  /** "No branch or pull request was created." */
  noBranch: boolean;
  pullRequest: {
    number: number;
    url: string;
    title: string;
    line: string;
    tone: OutcomeTone;
  } | null;
  composer: string;
  /** A failed run starts with its stages shown. */
  unfoldSteps: boolean;
};

const LIMITS: Record<string, string> = {
  steps_limit: "Stopped at the step limit.",
  time_limit: "Stopped at the time limit.",
  cost_limit: "Stopped at the cost limit.",
};

const FOLLOW_UPS =
  "Follow-ups aren't available yet. To change this pull request, start a new task or push to its branch.";
const NOTHING_TO_REVIEW = "Nothing to review here.";

function failure(
  run: RunResponse,
  projectId: string,
): Omit<OutcomeNotice, "tone" | "text" | "note"> {
  switch (run.error?.code) {
    case "prepare_failed":
    case "checkout_failed":
      return { title: "Couldn't prepare the sandbox", action: null };
    case "setup_failed":
      return {
        title: "Failed during setup",
        action: {
          label: "Re-run environment setup",
          href: environmentPath(projectId),
        },
      };
    case "no_environment":
      return {
        title: "This project isn't set up",
        action: { label: "Set it up", href: environmentPath(projectId) },
      };
    case "agent_failed":
      return { title: "Failed while working", action: null };
    case "verify_failed":
      return { title: "Failed while running the checks", action: null };
    case "deliver_failed":
      return { title: "Couldn't open the pull request", action: null };
    case "github_access":
      return {
        title: "Couldn't reach the repository on GitHub",
        action: { label: "Check the project", href: projectPath(projectId) },
      };
    case "worker_lost":
    case "lost_in_queue":
    case "worker_error":
      return { title: "CodeGenie stopped unexpectedly", action: null };
    default:
      return { title: "The run failed", action: null };
  }
}

function prLine(
  state: OutcomeState,
  run: RunResponse,
  baseBranch: string,
): string {
  const commit = run.commitSha
    ? ` · verified commit ${run.commitSha.slice(0, 7)} by codegenie[bot]`
    : "";
  switch (state) {
    case "pr_draft":
      return `Draft: ${run.status === "incomplete" ? "stopped before finishing" : "checks still failing"}${commit} · into ${baseBranch}`;
    case "merged":
      return `Merged into ${baseBranch}`;
    case "closed":
      return "Closed without merging";
    default:
      return `Ready for review${commit} · into ${baseBranch}`;
  }
}

const PR_STATES = {
  pr_open: { state: "pr_ready", tone: "ok", composer: FOLLOW_UPS },
  pr_draft: { state: "pr_draft", tone: "warn", composer: FOLLOW_UPS },
  merged: {
    state: "merged",
    tone: "merged",
    composer: "This pull request was merged. Changes from here are a new task.",
  },
  closed: {
    state: "closed",
    tone: "err",
    composer: "This pull request was closed.",
  },
} as const satisfies Partial<
  Record<
    TaskDetail["label"],
    { state: OutcomeState; tone: OutcomeTone; composer: string }
  >
>;

const isPrLabel = (
  label: TaskDetail["label"],
): label is keyof typeof PR_STATES => label in PR_STATES;

function runStatus(run: RunResponse, hasPr: boolean): RunOutcome["status"] {
  switch (run.status) {
    case "incomplete":
      return { label: "Incomplete", tone: "warn" };
    case "failed":
      return { label: "Failed", tone: "err" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return hasPr
        ? { label: "Succeeded", tone: "ok" }
        : { label: "No changes needed", tone: "neutral" };
  }
}

/** How a finished run turned out: what its result message and the composer say. Null while it runs. */
export function runOutcome({
  task,
  run,
  title,
  checksDone,
}: {
  task: Pick<TaskDetail, "label" | "pullRequest" | "project" | "baseBranch">;
  run: RunResponse;
  /** The task's title as the page shows it (the run may have just renamed it). */
  title: string;
  /** The run's events recorded the checks after its work. */
  checksDone: boolean;
}): RunOutcome | null {
  if (run.status === "queued" || run.status === "running") return null;

  const base = {
    status: runStatus(run, task.pullRequest !== null),
    summary: run.summary,
    showsChecks: false,
    noBranch: false,
    pullRequest: null,
    unfoldSteps: false,
  };
  const limit =
    run.status === "incomplete" && run.error
      ? LIMITS[run.error.code]
      : undefined;
  const limitNotice: OutcomeNotice | null =
    run.status === "incomplete"
      ? {
          tone: "warn",
          title: limit ?? "Stopped before finishing.",
          text: null,
          note: null,
          action: null,
        }
      : null;

  if (run.status === "failed") {
    return {
      ...base,
      state: "failed",
      summary: null,
      notice: {
        tone: "err",
        ...failure(run, task.project.id),
        text: run.error?.message ?? null,
        note:
          run.error?.code === "deliver_failed"
            ? "The changes are in Changes."
            : "Nothing was pushed.",
      },
      composer: "Fix the problem and start the task again.",
      unfoldSteps: true,
    };
  }

  if (run.status === "cancelled") {
    const started = run.startedAt !== null;
    return {
      ...base,
      state: "cancelled",
      summary: null,
      notice: {
        tone: "neutral",
        title:
          started && run.durationMs !== null
            ? `You cancelled this run after ${formatDuration(run.durationMs)}.`
            : started
              ? "You cancelled this run."
              : "You cancelled this run before it started.",
        text: null,
        note: started
          ? "The sandbox was removed and nothing was pushed."
          : "Nothing was pushed.",
        action: null,
      },
      composer: "You cancelled this task.",
    };
  }

  const pr =
    isPrLabel(task.label) && task.pullRequest
      ? { ...PR_STATES[task.label], ...task.pullRequest }
      : null;
  if (!pr) {
    return {
      ...base,
      state: run.status === "incomplete" ? "incomplete" : "no_changes",
      notice: limitNotice,
      noBranch: true,
      composer: NOTHING_TO_REVIEW,
    };
  }
  return {
    ...base,
    state: pr.state,
    notice: limitNotice,
    showsChecks: checksDone || run.checksPassed !== null,
    pullRequest: {
      number: pr.number,
      url: pr.url,
      title,
      line: prLine(pr.state, run, task.baseBranch),
      tone: pr.tone,
    },
    composer: pr.composer,
  };
}
