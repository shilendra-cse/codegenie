import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tasks } from "./tasks-schema";

export const jobTriggerEnum = pgEnum("job_trigger", [
  "initial",
  "follow_up",
  "pr_comment",
  "retry",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const jobStageEnum = pgEnum("job_stage", [
  "prepare",
  "checkout",
  "setup",
  "agent",
  "verify",
  "deliver",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    trigger: jobTriggerEnum("trigger").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    stage: jobStageEnum("stage"),
    sandboxId: text("sandbox_id"),
    model: text("model").notNull(),
    commitSha: text("commit_sha"),
    checksPassed: boolean("checks_passed"),
    summary: text("summary"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    steps: integer("steps").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_task_id_queued_at_idx").on(table.taskId, table.queuedAt),
    // At most one active job per task, so two workers never push to the same branch.
    uniqueIndex("jobs_one_active_per_task_idx")
      .on(table.taskId)
      .where(sql`${table.status} in ('queued', 'running')`),
    index("jobs_running_idx")
      .on(table.status)
      .where(sql`${table.status} = 'running'`),
  ],
);
