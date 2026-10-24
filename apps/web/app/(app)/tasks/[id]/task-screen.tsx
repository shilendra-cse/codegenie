"use client";

import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { UserMessage } from "@/components/molecules/user-message";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import { RunStatusCard } from "@/components/organisms/run-status-card";
import { TopBar } from "@/components/organisms/top-bar";
import { useAccount } from "@/features/account/use-account";
import { useTask } from "@/features/tasks/use-tasks";
import { ApiError } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { projectPath } from "@/lib/routes";

export type TaskScreenProps = { taskId: string };

export function TaskScreen({ taskId }: TaskScreenProps) {
  const { account } = useAccount();
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

  const { data } = task;
  const message = data.messages.find((m) => m.role === "user");
  // Newest first.
  const latest = data.runs[0];
  return (
    <>
      <TopBar
        title={data.title}
        parent={{
          label: data.project.name,
          href: projectPath(data.project.id),
        }}
      >
        <span className="ml-auto">
          <TaskStatusBadge
            label={data.label}
            prNumber={data.pullRequest?.number ?? null}
          />
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
        <RunStatusCard
          number={data.runs.length || 1}
          label={data.label}
          stage={data.latestRun?.stage ?? null}
          summary={latest?.summary ?? null}
          error={data.latestRun?.error?.message ?? null}
          pullRequest={data.pullRequest}
          durationMs={data.durationMs}
        />
      </div>
    </>
  );
}
