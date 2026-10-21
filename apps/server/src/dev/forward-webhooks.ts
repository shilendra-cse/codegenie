import { SmeeClient } from "smee-client";

const source = process.env.GITHUB_WEBHOOK_PROXY_URL;
if (!source) {
  console.error(
    "Set GITHUB_WEBHOOK_PROXY_URL (your smee.io channel) in apps/server/.env.",
  );
  process.exit(1);
}
const target = `http://localhost:${process.env.PORT ?? "3001"}/api/github/webhooks`;

await new SmeeClient({ source, target, logger: console }).start();
