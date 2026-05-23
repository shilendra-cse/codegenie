import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects-schema";
import { jobs } from "./jobs-schema";

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    role: messageRoleEnum("message_role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("messages_job_id_idx").on(table.jobId),
  ],
);
