"use client";

import type { TaskListItem } from "@codegenie/shared";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import {
  type ProjectTaskRow,
  ProjectTaskTable,
} from "@/components/organisms/project-task-table";
import { useProject } from "@/features/projects/projects";
import { useTaskPages } from "@/features/tasks/use-task-pages";
import { formatCost, formatDuration, timeAgo } from "@/lib/format";
import { newTaskPath, taskPath } from "@/lib/routes";

function projectTaskRow(task: TaskListItem, now: number): ProjectTaskRow {
  const started = task.durationMs > 0 || task.costUsd > 0;
  return {
    id: task.id,
    href: taskPath(task.id),
    title: task.title,
    status: (
      <TaskStatusBadge
        label={task.label}
        prNumber={task.pullRequest?.number ?? null}
      />
    ),
    pullRequest: task.pullRequest,
    runs: task.runCount,
    duration: started ? formatDuration(task.durationMs) : "—",
    cost: started ? formatCost(task.costUsd) : "—",
    updated: timeAgo(task.updatedAt, now),
  };
}

export type ProjectTasksScreenProps = { projectId: string };

export function ProjectTasksScreen({ projectId }: ProjectTasksScreenProps) {
  const name = useProject(projectId).project?.repo.name ?? "this project";
  const pages = useTaskPages({ projectId });
  const now = Date.now();
  const centered = "flex flex-col items-center gap-2.5 px-6 py-16 text-center";

  if (pages.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4 px-6 py-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (pages.isError) {
    return (
      <div role="alert" className={centered}>
        <span className="font-semibold">
          Couldn&apos;t load this project&apos;s tasks
        </span>
        <Button size="sm" onClick={() => void pages.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!pages.tasks?.length) {
    return (
      <div className={centered}>
        <span className="font-semibold">No tasks in this project yet</span>
        <span className="text-muted-foreground">
          Describe a change to {name} and CodeGenie opens a pull request for it.
        </span>
        <Button asChild size="sm" variant="primary" glow>
          <Link href={newTaskPath(projectId)}>
            <Icon icon={Plus} size={14} />
            New task
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <ProjectTaskTable
      rows={pages.tasks.map((task) => projectTaskRow(task, now))}
      hasMore={Boolean(pages.hasMore)}
      loadingMore={pages.loadingMore}
      onLoadMore={() => void pages.loadMore()}
    />
  );
}
