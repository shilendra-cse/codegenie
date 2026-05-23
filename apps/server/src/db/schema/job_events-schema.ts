import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { jobs } from "./jobs-schema";

export const jobEvents = pgTable(
  "job_events",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("job_events_job_id_created_at_idx").on(table.jobId, table.createdAt),
  ],
);
