import type { UserTask, UserTaskListItem } from "@codegenie/db";
import type {
  QueuedWork,
  TaskDetail,
  TaskLabel,
  TaskListItem,
} from "@codegenie/shared";
import type { JobsOptions } from "bullmq";
import { runDurationMs, toRunResponse } from "../runs/runs.types";

export type WorkQueue = {
  add<K extends keyof QueuedWork>(
    name: K,
    data: QueuedWork[K],
    options?: JobsOptions,
  ): Promise<unknown>;
};

export function taskLabel(task: UserTaskListItem): TaskLabel {
  const latest = task.runs[0];
  if (latest?.status === "queued") return "queued";
  if (latest?.status === "running") return "working";
  if (task.status === "merged") return "merged";
  if (task.status === "closed") return "closed";
  if (task.status === "pr_open") return task.prDraft ? "pr_draft" : "pr_open";
  if (latest?.status === "failed") return "failed";
  if (latest?.status === "cancelled") return "cancelled";
  return "no_changes";
}

const latestOf = (dates: (Date | null)[]) =>
  new Date(Math.max(...dates.map((d) => d?.getTime() ?? 0)));

export function toTaskListItem(task: UserTaskListItem): TaskListItem {
  const latest = task.runs[0];
  return {
    id: task.id,
    title: task.title,
    project: {
      id: task.project.id,
      owner: task.project.repoOwner,
      name: task.project.repoName,
    },
    label: taskLabel(task),
    baseBranch: task.baseBranch,
    branchName: task.branchName,
    pullRequest:
      task.prNumber !== null && task.prUrl !== null
        ? {
            number: task.prNumber,
            url: task.prUrl,
            draft: task.prDraft ?? false,
          }
        : null,
    latestRun: latest
      ? {
          id: latest.id,
          status: latest.status,
          stage: latest.stage,
          error: latest.errorCode
            ? { code: latest.errorCode, message: latest.errorMessage }
            : null,
        }
      : null,
    runCount: task.runs.length,
    durationMs: task.runs.reduce(
      (sum, run) => sum + (runDurationMs(run) ?? 0),
      0,
    ),
    costUsd: Number(
      task.runs.reduce((sum, run) => sum + Number(run.costUsd), 0).toFixed(4),
    ),
    createdAt: task.createdAt.toISOString(),
    updatedAt: latestOf([
      task.updatedAt,
      ...task.runs.flatMap((run) => [
        run.queuedAt,
        run.startedAt,
        run.finishedAt,
      ]),
    ]).toISOString(),
  };
}

export function toTaskDetail(task: UserTask): TaskDetail {
  return {
    ...toTaskListItem(task),
    messages: task.messages.map((message) => ({
      id: message.id,
      role: message.role,
      authorUserId: message.authorUserId,
      runId: message.runId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
    runs: task.runs.map(toRunResponse),
  };
}
