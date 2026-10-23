import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { onboardings } from "./onboardings-schema";

export const onboardingEvents = pgTable(
  "onboarding_events",
  {
    onboardingId: uuid("onboarding_id")
      .references(() => onboardings.id, { onDelete: "cascade" })
      .notNull(),
    // 1, 2, 3… per setup, assigned by the worker (its only writer). Used as the SSE event id.
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
  (table) => [primaryKey({ columns: [table.onboardingId, table.seq] })],
);
