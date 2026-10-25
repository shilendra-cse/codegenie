import type { TaskLabel } from "@codegenie/shared";
import {
  CircleCheck,
  CircleDot,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  type LucideIcon,
  MessageCircle,
} from "lucide-react";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";

export type TaskStatus = TaskLabel | "needs_you";

export const TASK_STATUS_TEXT: Record<TaskStatus, string> = {
  needs_you: "needs your answer",
  queued: "queued",
  working: "working",
  pr_open: "PR open",
  pr_draft: "draft PR",
  merged: "merged",
  closed: "PR closed",
  no_changes: "no changes",
  failed: "failed",
  cancelled: "cancelled",
};

const ICONS: Record<
  Exclude<TaskStatus, "queued" | "working">,
  { icon: LucideIcon; className: string }
> = {
  needs_you: { icon: MessageCircle, className: "text-primary-text" },
  pr_open: { icon: GitPullRequest, className: "text-ok" },
  pr_draft: { icon: GitPullRequestDraft, className: "text-warn" },
  merged: { icon: GitMerge, className: "text-merged" },
  closed: { icon: GitPullRequest, className: "text-faint" },
  no_changes: { icon: CircleCheck, className: "text-faint" },
  failed: { icon: CircleX, className: "text-err" },
  cancelled: { icon: CircleDot, className: "text-faint" },
};

export function TaskStatusIcon({
  status,
  size = 14,
}: {
  status: TaskStatus;
  size?: 14 | 16;
}) {
  if (status === "queued" || status === "working") {
    return <Spinner size={size} className="text-primary-text" />;
  }
  const { icon, className } = ICONS[status];
  return <Icon icon={icon} size={size} className={className} />;
}
