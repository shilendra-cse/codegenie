import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { StepMarker } from "@/components/atoms/step-marker";
import { cn } from "@/lib/utils";

export type ChecklistStepAction = {
  label: string;
  href: string;
  external: boolean;
};

export type ChecklistStepProps = {
  number: number;
  state: "done" | "current" | "todo";
  title: string;
  body: string;
  /** Replaces the body once the step is done, e.g. "dodesk added." */
  doneBody?: ReactNode;
  action?: ChecklistStepAction;
  hint?: string;
  /** Shown in place of the action while the step is current: the step happens right here. */
  panel?: ReactNode;
  className?: string;
};

function Action({
  action,
  hint,
}: {
  action: ChecklistStepAction;
  hint?: string;
}) {
  return (
    <>
      <Button asChild variant="primary" glow>
        {action.external ? (
          <a href={action.href}>{action.label}</a>
        ) : (
          <Link href={action.href}>{action.label}</Link>
        )}
      </Button>
      {hint && <span className="text-[13px] text-faint">{hint}</span>}
    </>
  );
}

export function ChecklistStep({
  number,
  state,
  title,
  body,
  doneBody,
  action,
  hint,
  panel,
  className,
}: ChecklistStepProps) {
  const current = state === "current";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "flex gap-4 border-b border-border p-5 last:border-b-0",
        current && "bg-surface",
        className,
      )}
    >
      <StepMarker number={number} state={state} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-[15px] font-semibold",
            state === "todo" && "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <span className="text-muted-foreground">
          {state === "done" && doneBody ? doneBody : body}
        </span>
        {current && panel && <div className="mt-3.5">{panel}</div>}
        {current && !panel && action && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <Action action={action} hint={hint} />
          </div>
        )}
      </div>
    </li>
  );
}
