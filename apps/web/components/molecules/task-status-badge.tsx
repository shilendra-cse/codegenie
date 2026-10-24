import type { TaskLabel } from "@codegenie/shared";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";

export type TaskStatusBadgeProps = {
  label: TaskLabel;
  prNumber: number | null;
};

export function TaskStatusBadge({ label, prNumber }: TaskStatusBadgeProps) {
  const pr = prNumber === null ? "PR" : `PR #${prNumber}`;
  switch (label) {
    case "queued":
      return <Badge>Queued</Badge>;
    case "working":
      return (
        <Badge tone="progress" className="sheen">
          <Spinner size={12} />
          Working
        </Badge>
      );
    case "pr_open":
      return <Badge tone="ok">{pr} open</Badge>;
    case "pr_draft":
      return <Badge tone="warn">Draft {pr}</Badge>;
    case "merged":
      return <Badge tone="merged">{pr} merged</Badge>;
    case "closed":
      return <Badge tone="err">{pr} closed</Badge>;
    case "no_changes":
      return <Badge>No changes</Badge>;
    case "failed":
      return <Badge tone="err">Failed</Badge>;
    case "cancelled":
      return <Badge>Cancelled</Badge>;
  }
}
