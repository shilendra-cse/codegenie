import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** GitHub webhook idempotency: insert first, skip processing on conflict. */
export const webhookDeliveries = pgTable("webhook_deliveries", {
  deliveryId: text("delivery_id").primaryKey(),
  event: text("event").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
