import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const projectStatusEnum = pgEnum("project_status", [
  "provisioning",
  "ready",
  "failed",
]);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    githubOwner: text("github_owner"),
    githubRepo: text("github_repo"),
    defaultBranch: text("default_branch").notNull().default("main"),
    workspacePath: text("workspace_path").notNull(),
    previewPort: integer("preview_port"), //optional
    status: projectStatusEnum("project_status")
      .notNull()
      .default("provisioning"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("projects_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);
