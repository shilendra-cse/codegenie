import type { Db } from "../../client.js";
import { webhookDeliveries } from "../../schema/github/webhook-deliveries-schema.js";

export async function recordWebhookDelivery(
  db: Db,
  deliveryId: string,
  event: string,
) {
  const inserted = await db
    .insert(webhookDeliveries)
    .values({ deliveryId, event })
    .onConflictDoNothing()
    .returning({ deliveryId: webhookDeliveries.deliveryId });
  return inserted.length > 0;
}
