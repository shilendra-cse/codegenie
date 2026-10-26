import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** What a plan allows. Seeded with `free` and `unlimited` by the migration. */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // null = no limit.
  runsPerCycle: integer("runs_per_cycle"),
  concurrentRuns: integer("concurrent_runs").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
