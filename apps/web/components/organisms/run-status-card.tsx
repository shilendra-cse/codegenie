import type { RunStage, TaskLabel } from "@codegenie/shared";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Logo } from "@/components/atoms/logo";
import { Spinner } from "@/components/atoms/spinner";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const STAGES: Record<RunStage, string> = {
  prepare: "Preparing a sandbox",
  checkout: "Checking out the code",
  setup: "Setting up the environment",
  agent: "Working on the change",
  verify: "Running the checks",
  deliver: "Opening the pull request",
};

export type RunStatusCardProps = {
  number: number;
  label: TaskLabel;
  stage: RunStage | null;
  summary: string | null;
  error: string | null;
  pullRequest: { number: number; url: string } | null;
  durationMs: number | null;
};

function what({ label, stage, summary, error }: RunStatusCardProps) {
  switch (label) {
    case "queued":
      return "Waiting to start. It begins in a moment.";
    case "working":
      return stage ? `${STAGES[stage]}…` : "Starting…";
    case "failed":
      return error ?? "The run failed.";
    case "cancelled":
      return "The run was cancelled. Nothing was pushed.";
    default:
      return summary ?? "Done.";
  }
}

/** The task's run, until the live run view shows its stages and the agent's work. */
export function RunStatusCard(props: RunStatusCardProps) {
  const live = props.label === "queued" || props.label === "working";
  return (
    <div className={cn("rise", live && "beam shadow-none")}>
      <section
        aria-label={`Run ${props.number}`}
        className={cn(
          "flex flex-col gap-3 rounded-lg bg-card p-[18px]",
          !live && "border border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
            <Logo variant="mark" />
          </span>
          <span className="font-semibold">CodeGenie</span>
          <span className="text-[13px] text-faint">Run {props.number}</span>
          <span className="ml-auto flex items-center gap-2.5">
            {props.durationMs !== null && props.durationMs > 0 && (
              <span className="text-[13px] text-faint">
                {formatDuration(props.durationMs)}
              </span>
            )}
            <TaskStatusBadge
              label={props.label}
              prNumber={props.pullRequest?.number ?? null}
            />
          </span>
        </div>
        <p
          className={cn(
            "flex items-center gap-2 whitespace-pre-wrap",
            props.label === "failed" ? "text-err" : "text-muted-foreground",
          )}
        >
          {live && <Spinner size={14} />}
          {what(props)}
        </p>
        {props.pullRequest && (
          <Button asChild size="sm" className="self-start">
            <a href={props.pullRequest.url} target="_blank" rel="noreferrer">
              Open PR #{props.pullRequest.number} on GitHub
              <Icon icon={ExternalLink} size={14} />
            </a>
          </Button>
        )}
      </section>
    </div>
  );
}
