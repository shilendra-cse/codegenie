import { Check, CircleX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LineState = "done" | "warn" | "failed" | "running";

const MARKS = {
  done: <Icon icon={Check} label="Done" className="text-ok" />,
  warn: (
    <Icon icon={TriangleAlert} label="Needs a look" className="text-warn" />
  ),
  failed: <Icon icon={CircleX} label="Failed" className="text-err" />,
  running: <Spinner label="In progress" className="text-primary-text" />,
} satisfies Record<LineState, ReactNode>;

export type TimelineLineProps = {
  state: LineState;
  durationMs: number | null;
  className?: string;
  children: ReactNode;
};

export function TimelineLine({
  state,
  durationMs,
  className,
  children,
}: TimelineLineProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-2.5 [&+&]:border-t [&+&]:border-dashed [&+&]:border-border",
        className,
      )}
    >
      <span className="mt-0.5">{MARKS[state]}</span>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2",
          state === "running" && "text-muted-foreground",
        )}
      >
        {children}
      </div>
      {durationMs !== null && (
        <span className="text-[13px] text-faint">
          {formatDuration(durationMs)}
        </span>
      )}
    </div>
  );
}
