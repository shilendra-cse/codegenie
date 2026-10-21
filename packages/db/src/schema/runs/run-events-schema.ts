import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { runs } from "./runs-schema";

export const runEvents = pgTable(
  "run_events",
  {
    runId: uuid("run_id")
      .references(() => runs.id, { onDelete: "cascade" })
      .notNull(),
    // 1, 2, 3… per run, assigned by the worker (the run's only writer). Used as the SSE event id.
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
  (table) => [primaryKey({ columns: [table.runId, table.seq] })],
);
