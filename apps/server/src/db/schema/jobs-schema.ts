import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects-schema";

export const statusEnum = pgEnum("status", [
  "queued",
  "running",
  "done",
  "failed",
]);

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  status: statusEnum("status").notNull(),
  error: text("error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
