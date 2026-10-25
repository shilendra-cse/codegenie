import { z } from "zod";
import type { RunError, RunResponse, RunStage, RunStatus } from "./runs";

export const createTaskSchema = z.object({
  prompt: z.string().trim().min(1, "Describe the task.").max(20_000),
  baseBranch: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^(?!-)[^\s~^:?*[\\]+$/, "Not a valid branch name.")
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const TASK_FILTERS = ["running", "pr", "done"] as const;

export type TaskFilter = (typeof TASK_FILTERS)[number];

export const listTasksQuerySchema = z.object({
  projectId: z.uuid("The project id must be a UUID.").optional(),
  filter: z.enum(TASK_FILTERS, "Not a valid filter.").optional(),
  cursor: z.uuid("Not a valid cursor.").optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const taskParamsSchema = z.object({
  id: z.uuid("The task id must be a UUID."),
});

export type TaskLabel =
  | "queued"
  | "working"
  | "pr_open"
  | "pr_draft"
  | "merged"
  | "closed"
  | "no_changes"
  | "failed"
  | "cancelled";

export type TaskListItem = {
  id: string;
  title: string;
  project: { id: string; owner: string; name: string };
  label: TaskLabel;
  baseBranch: string;
  branchName: string | null;
  pullRequest: { number: number; url: string; draft: boolean } | null;
  latestRun: {
    id: string;
    status: RunStatus;
    stage: RunStage | null;
    error: RunError | null;
    checksPassed: boolean | null;
    filesChanged: number | null;
    summaryLine: string | null;
  } | null;
  runCount: number;
  durationMs: number;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  authorUserId: string | null;
  runId: string | null;
  content: string;
  createdAt: string;
};

export type TaskDetail = TaskListItem & {
  messages: TaskMessage[];
  runs: RunResponse[];
};

export type TaskCounts = Record<"all" | TaskFilter, number>;

export type TaskPage = {
  tasks: TaskListItem[];
  nextCursor: string | null;
  counts: TaskCounts;
};

export type CreatedTask = {
  task: {
    id: string;
    projectId: string;
    title: string;
    baseBranch: string;
    createdAt: string;
  };
  run: { id: string; status: "queued"; model: string };
};
