import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const statusEnum = pgEnum("status", ["provisioning", "ready", "failed"]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  name: text("name").notNull(),
  githubOwner: text("github_owner"),
  githubRepo: text("github_repo"),
  workspacePath: text("workspace_path").notNull(),
  previewPort: integer("preview_port"),
  status: statusEnum("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
