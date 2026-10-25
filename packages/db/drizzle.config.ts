import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The development database is the one in apps/server/docker-compose.yml, configured in its .env.
// drizzle-kit runs from this package's folder (pnpm --filter @hobai/db …).
loadEnv({
  path: path.resolve("..", "..", "apps", "server", ".env"),
  quiet: true,
});

const env = process.env;
const url =
  env.DATABASE_URL ||
  `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
