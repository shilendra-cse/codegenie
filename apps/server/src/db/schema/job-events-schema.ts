import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs-schema";

export const jobEvents = pgTable(
  "job_events",
  {
    jobId: uuid("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    // 1, 2, 3… per job, assigned by the worker (the job's only writer). Used as the SSE event id.
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.seq] })],
);
