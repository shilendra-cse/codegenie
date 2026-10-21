import type { IncomingMessage } from "http";

// Signed payloads (GitHub webhooks) are verified against the exact bytes received, not the parsed JSON.
export function keepRawBody(req: IncomingMessage, _res: unknown, buf: Buffer) {
  req.rawBody = buf;
}
