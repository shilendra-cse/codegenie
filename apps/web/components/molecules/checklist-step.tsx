import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { StepMarker } from "@/components/atoms/step-marker";
import { cn } from "@/lib/utils";

export type ChecklistStepProps = {
  number: number;
  state: "done" | "current" | "todo";
  title: string;
  body: string;
  action: { label: string; href: string; external: boolean };
  hint?: string;
  className?: string;
};

export function ChecklistStep({
  number,
  state,
  title,
  body,
  action,
  hint,
  className,
}: ChecklistStepProps) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={cn(
        "flex gap-4 border-b border-border p-5 last:border-b-0",
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
        <span className="text-muted-foreground">{body}</span>
        {state === "current" && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <Button asChild variant="primary" glow>
              {action.external ? (
                <a href={action.href}>{action.label}</a>
              ) : (
                <Link href={action.href}>{action.label}</Link>
              )}
            </Button>
            {hint && <span className="text-[13px] text-faint">{hint}</span>}
          </div>
        )}
      </div>
    </li>
  );
}
