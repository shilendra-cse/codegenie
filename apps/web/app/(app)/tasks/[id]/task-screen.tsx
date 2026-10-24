"use client";

import type { TaskDetail } from "@codegenie/shared";
import { GitBranch, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import { UserMessage } from "@/components/molecules/user-message";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";
import type { ActivityView } from "@/components/organisms/run-activity";
import { RunCard } from "@/components/organisms/run-card";
import { RunResult } from "@/components/organisms/run-result";
import { type PanelTab, RunPanel } from "@/components/organisms/run-panel";
import { TopBar } from "@/components/organisms/top-bar";
import { useAccount } from "@/features/account/use-account";
import { useRunDiff } from "@/features/runs/diff";
import { runOutcome } from "@/features/runs/outcome";
import { buildRunView } from "@/features/runs/run-view";
import { useCancelRun } from "@/features/runs/use-cancel-run";
import { useRunEvents } from "@/features/runs/use-run-events";
import { useTask } from "@/features/tasks/use-tasks";
import { ApiError } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { projectPath } from "@/lib/routes";
import { useNow } from "@/lib/use-now";
import {
  runTotals,
  toPanelChanges,
  toRunCard,
  toRunResult,
} from "./run-card-view";

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
  const diff = useRunDiff(run?.id, Boolean(run) && !active);
  const [tab, setTab] = useState<PanelTab>("changes");
  const [file, setFile] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const cancel = useCancelRun(task.id);
  const message = task.messages.find((m) => m.role === "user");
  const title = view.title ?? task.title;
  const outcome =
    run && runOutcome({ task, run, title, checksDone: view.checksDone });

  const openActivity = (row: ActivityView) => {
    if (row.kind === "edit") {
      setTab("changes");
      setFile(row.path);
    } else if (row.kind === "command") {
      setTab("terminal");
      setCommand(row.id);
    } else if (row.kind === "checks") {
      setTab("checks");
    }
  };

  return (
    // On wide screens the page fits the window: the top bar stays, and the conversation and the
    // panel scroll on their own. Narrower, the panel stacks below and the page scrolls as usual.
    <div className="flex flex-1 flex-col min-[1200px]:h-screen min-[1200px]:max-h-screen min-[1200px]:overflow-hidden">
      <TopBar
        title={title}
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
        {run && active && (
          <Button
            variant="danger"
            size="sm"
            busy={cancel.pending || cancel.stopping}
            onClick={() => cancel.cancel(run.id)}
          >
            {!cancel.pending && !cancel.stopping && (
              <Icon icon={Square} size={14} />
            )}
            {cancel.stopping ? "Stopping…" : "Cancel"}
          </Button>
        )}
      </TopBar>
      {cancel.error && active && (
        <Alert tone="error" className="mx-6 mt-4">
          Couldn&apos;t cancel. Try again.
        </Alert>
      )}
      <div className="flex flex-1 flex-wrap min-[1200px]:min-h-0 min-[1200px]:flex-nowrap">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6 px-6 pt-8 pb-20 min-[1200px]:overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
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
                  now,
                })}
                onSelectActivity={openActivity}
              />
            )}
            {run && outcome && (
              <RunResult
                {...toRunResult({
                  outcome,
                  run,
                  number: task.runs.length,
                  view,
                  now,
                })}
              />
            )}
          </div>
        </div>
        {run && (
          <RunPanel
            tab={tab}
            onTabChange={setTab}
            changes={toPanelChanges({ active, view, diff, file })}
            selectedFile={file}
            onSelectFile={setFile}
            commands={view.commands}
            selectedCommand={command}
            checks={view.checks}
            checksAfter={
              view.checksDone ? "done" : active ? "pending" : "missing"
            }
          />
        )}
      </div>
    </div>
  );
}
