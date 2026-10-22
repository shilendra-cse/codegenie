import type { QueuedWork } from "@codegenie/shared";
import type { JobsOptions } from "bullmq";
import { z } from "zod";

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

export type WorkQueue = {
  add<K extends keyof QueuedWork>(
    name: K,
    data: QueuedWork[K],
    options?: JobsOptions,
  ): Promise<unknown>;
};

export type CreatedTaskResponse = {
  task: {
    id: string;
    projectId: string;
    title: string;
    baseBranch: string;
    createdAt: string;
  };
  run: { id: string; status: "queued"; model: string };
};
