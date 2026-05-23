import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects-schema";

export const roleEnum = pgEnum("role", ["user", "assistant", "tool", "system"]);

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  role: roleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
