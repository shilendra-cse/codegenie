import type {
  OnboardingResponse,
  ProjectResponse,
  TaskListItem,
} from "@codegenie/shared";
import { Badge } from "@/components/atoms/badge";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import type { InboxRow } from "@/components/organisms/inbox-list";
import { taskDetail } from "@/features/tasks/inbox";
import { formatCost, formatDuration, timeAgo } from "@/lib/format";
import { environmentPath, taskPath } from "@/lib/routes";

export type SetupNeedingYou = {
  project: ProjectResponse;
  onboarding: OnboardingResponse | null;
};

const totals = (ms: number, usd: number) =>
  ms === 0 && usd === 0 ? "—" : `${formatDuration(ms)} · ${formatCost(usd)}`;

export function taskRow(task: TaskListItem, now: number): InboxRow {
  return {
    id: task.id,
    href: taskPath(task.id),
    status: task.label,
    title: task.title,
    detail: taskDetail(task),
    project: task.project.name,
    badge: (
      <TaskStatusBadge
        label={task.label}
        prNumber={task.pullRequest?.number ?? null}
      />
    ),
    durationAndCost: totals(task.durationMs, task.costUsd),
    when: timeAgo(task.updatedAt, now),
  };
}

export function setupRow(
  { project, onboarding }: SetupNeedingYou,
  now: number,
): InboxRow {
  const started = onboarding?.startedAt ?? onboarding?.queuedAt;
  return {
    id: `setup-${project.id}`,
    href: environmentPath(project.id),
    status: "needs_you",
    title: `Set up ${project.repo.name}`,
    detail: "CodeGenie has a question",
    project: project.repo.name,
    badge: <Badge tone="progress">Needs your answer</Badge>,
    durationAndCost:
      onboarding && started
        ? totals(now - Date.parse(started), onboarding.costUsd)
        : "—",
    when: started ? timeAgo(started, now) : "",
  };
}
