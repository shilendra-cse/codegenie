import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./webhook-signature.js";

// GitHub's documented example: https://docs.github.com/webhooks/using-webhooks/validating-webhook-deliveries
const secret = "It's a Secret to Everybody";
const body = "Hello, World!";
const signature =
  "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

describe("verifyWebhookSignature", () => {
  it("accepts GitHub's signature of the raw body", () => {
    expect(verifyWebhookSignature(secret, body, signature)).toBe(true);
    expect(verifyWebhookSignature(secret, Buffer.from(body), signature)).toBe(
      true,
    );
  });

  it.each([
    ["a different body", secret, "Hello, World?", signature],
    ["a different secret", "guess", body, signature],
    ["a truncated signature", secret, body, signature.slice(0, 20)],
    ["the old sha1 header", secret, body, "sha1=abc"],
    ["no signature", secret, body, undefined],
  ])("rejects %s", (_case, key, payload, header) => {
    expect(verifyWebhookSignature(key, payload, header)).toBe(false);
  });
});
