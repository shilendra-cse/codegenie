import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signature: string | undefined,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
  );
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
