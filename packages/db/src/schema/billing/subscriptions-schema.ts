import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/auth-schema";
import { plans } from "./plans-schema";

export const subscriptionSourceEnum = pgEnum("subscription_source", [
  "signup",
  "admin",
]);

/** Which plan a user is on, and their current cycle. One per user. */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  planId: uuid("plan_id")
    .references(() => plans.id, { onDelete: "restrict" })
    .notNull(),
  source: subscriptionSourceEnum("source").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
