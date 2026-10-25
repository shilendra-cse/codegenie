import Link from "next/link";
import type { ReactNode } from "react";
import { type TaskStatus, TaskStatusIcon } from "./task-status-icon";

export type TaskRowProps = {
  href: string;
  status: TaskStatus;
  title: string;
  detail: string;
  project: string;
  badge: ReactNode;
  durationAndCost: string;
  when: string;
};

export function TaskRow({
  href,
  status,
  title,
  detail,
  project,
  badge,
  durationAndCost,
  when,
}: TaskRowProps) {
  return (
    <Link
      href={href}
      className="rise flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-border px-6 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <span className="inline-flex w-4 justify-center">
        <TaskStatusIcon status={status} size={16} />
      </span>
      <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-[13px] text-faint">{detail}</span>
      </span>
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-sm border border-border bg-code px-2 text-xs text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-faint" />
        {project}
      </span>
      {badge}
      <span className="w-[120px] text-right text-[13px] text-faint">
        {durationAndCost}
      </span>
      <span className="w-20 text-right text-[13px] text-faint">{when}</span>
    </Link>
  );
}
