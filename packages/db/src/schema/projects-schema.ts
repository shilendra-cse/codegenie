import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { githubInstallations } from "./github-installations-schema";

/** Commands detected (or declared in AGENTS.md / .codegenie.yml) for a repo. */
export type ProjectSetupConfig = {
  install?: string;
  lint?: string;
  typecheck?: string;
  test?: string;
  build?: string;
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    installationId: uuid("installation_id")
      .references(() => githubInstallations.id, { onDelete: "cascade" })
      .notNull(),
    repoGithubId: bigint("repo_github_id", { mode: "number" }).notNull(),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    setupConfig: jsonb("setup_config").$type<ProjectSetupConfig>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("projects_user_id_repo_github_id_unique").on(
      table.userId,
      table.repoGithubId,
    ),
    index("projects_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);
