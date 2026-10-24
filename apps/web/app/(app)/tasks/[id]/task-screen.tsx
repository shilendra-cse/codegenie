"use client";

import type { TaskDetail } from "@codegenie/shared";
import { GitBranch } from "lucide-react";
import { useMemo } from "react";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import { UserMessage } from "@/components/molecules/user-message";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import { RunCard } from "@/components/organisms/run-card";
import { TopBar } from "@/components/organisms/top-bar";
import { useAccount } from "@/features/account/use-account";
import { buildRunView } from "@/features/runs/run-view";
import { useRunEvents } from "@/features/runs/use-run-events";
import { useTask } from "@/features/tasks/use-tasks";
import { ApiError } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { projectPath } from "@/lib/routes";
import { useNow } from "@/lib/use-now";
import { runTotals, toRunCard } from "./run-card-view";

export type TaskScreenProps = { taskId: string };

export function TaskScreen({ taskId }: TaskScreenProps) {
  const task = useTask(taskId);

  if (task.error) {
    const missing =
      task.error instanceof ApiError && task.error.code === "TASK_NOT_FOUND";
    return (
      <div className="mx-auto w-full max-w-[780px] px-6 py-10">
        <Alert tone="error" className="flex flex-wrap items-center gap-3">
          <span className="flex-1">
            {missing
              ? "This task doesn't exist or isn't yours."
              : "Couldn't load this task."}
          </span>
          {!missing && (
            <Button size="sm" onClick={() => void task.refetch()}>
              Try again
            </Button>
          )}
        </Alert>
      </div>
    );
  }

  if (!task.data) {
    return (
      <div
        aria-busy
        aria-label="Loading the task"
        className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-6 pt-8"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  return <TaskView task={task.data} />;
}

function TaskView({ task }: { task: TaskDetail }) {
  const { account } = useAccount();
  // Newest first.
  const run = task.runs[0];
  const active = run?.status === "queued" || run?.status === "running";
  const { events, live } = useRunEvents(
    run && { id: run.id, taskId: task.id, ended: !active },
  );
  const view = useMemo(() => buildRunView(events), [events]);
  const now = useNow(active);
  const message = task.messages.find((m) => m.role === "user");

  return (
    <>
      <TopBar
        title={view.title ?? task.title}
        parent={{
          label: task.project.name,
          href: projectPath(task.project.id),
        }}
      >
        <TaskStatusBadge
          label={task.label}
          prNumber={task.pullRequest?.number ?? null}
        />
        <span className="ml-auto inline-flex items-center gap-3 text-[13px] text-faint">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <Icon icon={GitBranch} size={14} />
            {task.baseBranch}
          </span>
          {run && runTotals(run, live, now)}
        </span>
      </TopBar>
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-6 pt-8 pb-20">
        {message && (
          <UserMessage
            name={account?.name ?? "You"}
            image={account?.image ?? null}
            time={timeAgo(message.createdAt)}
            content={message.content}
          />
        )}
        {run && (
          <RunCard
            {...toRunCard({
              run,
              number: task.runs.length,
              view,
              live,
              baseBranch: task.baseBranch,
              pullRequest: task.pullRequest,
              now,
            })}
          />
        )}
      </div>
    </>
  );
}
