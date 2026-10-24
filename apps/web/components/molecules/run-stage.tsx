import { Check, Circle, CircleX, Square } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RunStageState =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "stopped"
  | "skipped";

const MARKS = {
  pending: <Icon icon={Circle} label="Not started" className="text-faint" />,
  running: <Spinner label="In progress" className="text-primary-text" />,
  done: <Icon icon={Check} label="Done" className="text-ok" />,
  failed: <Icon icon={CircleX} label="Failed" className="text-err" />,
  stopped: <Icon icon={Square} label="Stopped" className="text-faint" />,
  skipped: <Icon icon={Circle} label="Skipped" className="text-faint" />,
} satisfies Record<RunStageState, ReactNode>;

export type RunStageProps = {
  name: string;
  state: RunStageState;
  summary: ReactNode;
  durationMs: number | null;
  /** What happened inside the stage, e.g. the agent's work. */
  children?: ReactNode;
};

export function RunStage({
  name,
  state,
  summary,
  durationMs,
  children,
}: RunStageProps) {
  const quiet = state === "pending" || state === "skipped";
  return (
    <section
      aria-label={name}
      className={cn(
        "flex gap-3 border-t border-border px-4 py-3 first:border-t-0",
        state === "running" && "bg-surface",
      )}
    >
      <span className="mt-0.5">{MARKS[state]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className={cn(quiet && "text-faint")}>
          <span className="font-medium">{name}</span>
          {summary && (
            <span className={cn(!quiet && "text-muted-foreground")}>
              {" · "}
              {summary}
            </span>
          )}
        </p>
        {children}
      </div>
      {durationMs !== null && (
        <span className="text-[13px] text-faint">
          {formatDuration(durationMs)}
        </span>
      )}
    </section>
  );
}
