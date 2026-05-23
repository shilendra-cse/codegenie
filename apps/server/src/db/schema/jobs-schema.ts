import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects-schema";

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title"),
    status: jobStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    branchName: text("branch_name"),
    prUrl: text("pr_url"),
    commitSha: text("commit_sha"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("jobs_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
