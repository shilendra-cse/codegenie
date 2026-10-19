import type { EnvironmentConfig } from "@codegenie/shared";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { projects } from "./projects-schema";

export const environmentSourceEnum = pgEnum("environment_source", [
  "detected",
  "ai",
  "user",
  "mixed",
]);

export const environmentStatusEnum = pgEnum("environment_status", [
  "active",
  "superseded",
]);

export const environmentHealthEnum = pgEnum("environment_health", [
  "ok",
  "needs_attention",
]);

/** A project's environment config versions; jobs replay the active one. */
export const projectEnvironments = pgTable(
  "project_environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    config: jsonb("config").$type<EnvironmentConfig>().notNull(),
    source: environmentSourceEnum("source").notNull(),
    status: environmentStatusEnum("status").notNull().default("active"),
    health: environmentHealthEnum("health").notNull().default("ok"),
    healthReasons: jsonb("health_reasons")
      .$type<string[]>()
      .notNull()
      .default([]),
    healthUpdatedAt: timestamp("health_updated_at", { withTimezone: true }),
    verifiedCommit: text("verified_commit"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_environments_project_id_version_idx").on(
      table.projectId,
      table.version,
    ),
    // At most one active config per project.
    uniqueIndex("project_environments_one_active_idx")
      .on(table.projectId)
      .where(sql`${table.status} = 'active'`),
    index("project_environments_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
