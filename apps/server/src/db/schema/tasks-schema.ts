import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { projects } from "./projects-schema";

export const taskSourceEnum = pgEnum("task_source", [
  "prompt",
  "jira",
  "notion",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "pr_open",
  "merged",
  "closed",
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    createdByUserId: text("created_by_user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    source: taskSourceEnum("source").notNull().default("prompt"),
    sourceRef: text("source_ref"),
    sourceUrl: text("source_url"),
    baseBranch: text("base_branch").notNull(),
    branchName: text("branch_name"),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    status: taskStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("tasks_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
