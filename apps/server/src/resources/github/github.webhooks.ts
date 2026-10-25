import { forgetWebhookDelivery, recordWebhookDelivery } from "@hobai/db";
import { verifyWebhookSignature } from "@hobai/github";
import type { RequestHandler } from "express";
import { handleGithubEvent, type WebhookDeps } from "./github.webhook-events";

export function createGithubWebhookHandler(
  deps: WebhookDeps & { secret: string },
): RequestHandler {
  return async (req, res) => {
    const signature = req.get("x-hub-signature-256");
    if (
      !req.rawBody ||
      !verifyWebhookSignature(deps.secret, req.rawBody, signature)
    ) {
      res.status(401).json({ message: "Invalid signature" });
      return;
    }
    const event = req.get("x-github-event");
    const deliveryId = req.get("x-github-delivery");
    if (!event || !deliveryId) {
      res.status(400).json({ message: "Missing GitHub event headers" });
      return;
    }
    if (!(await recordWebhookDelivery(deps.db, deliveryId, event))) {
      res.status(200).json({ duplicate: true });
      return;
    }

    try {
      await handleGithubEvent(deps, event, req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      // Forgotten so GitHub's redelivery of this event is processed, not skipped as a duplicate.
      await forgetWebhookDelivery(deps.db, deliveryId);
      deps.log("error", "GitHub webhook failed", {
        event,
        deliveryId,
        error: String(error),
      });
      res.status(500).json({ message: "Webhook failed" });
    }
  };
}
