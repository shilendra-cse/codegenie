import { sql } from "drizzle-orm";
import {
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
import { user } from "../auth/auth-schema";
import { projectEnvironments } from "./project-environments-schema";
import { projects } from "./projects-schema";

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
]);

/** One environment setup of a project, started from the website. */
export const onboardings = pgTable(
  "onboardings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: onboardingStatusEnum("status").notNull().default("queued"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    // The question setup is waiting on, while `waiting`.
    openQuestionId: text("open_question_id"),
    environmentId: uuid("environment_id").references(
      () => projectEnvironments.id,
      { onDelete: "set null" },
    ),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
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
    index("onboardings_project_id_queued_at_idx").on(
      table.projectId,
      table.queuedAt,
    ),
    // At most one setup at a time per project.
    uniqueIndex("onboardings_one_active_per_project_idx")
      .on(table.projectId)
      .where(sql`${table.status} in ('queued', 'running', 'waiting')`),
  ],
);
