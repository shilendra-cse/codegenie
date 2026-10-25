import path from "node:path";

// Ports of their own, so a run never meets the dev servers on 3000 and 3001.
export const WEB_URL = "http://localhost:3100";
export const API_PORT = 3101;
export const API_URL = `http://localhost:${API_PORT}`;
export const WORKER_HEALTH_PORT = 3102;

// The dev Postgres and Redis servers, with a database and a Redis database number of their own.
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://codegenie_user:codegenie_password@localhost:5439/codegenie_e2e";
export const REDIS_URL =
  process.env.E2E_REDIS_URL ?? "redis://localhost:6380/1";

export const WEBHOOK_SECRET = "e2e-webhook-secret";

export const STATE_DIR = path.join(import.meta.dirname, "..", ".state");
export const LOG_DIR = path.join(STATE_DIR, "logs");
/** Exists once the test has "installed" the App on GitHub; the fake GitHub reads it. */
export const INSTALLED_FLAG = path.join(STATE_DIR, "github-installed");

export const serverEnv = {
  NODE_ENV: "test",
  PORT: String(API_PORT),
  DATABASE_URL,
  REDIS_URL,
  FRONTEND_URL: WEB_URL,
  BETTER_AUTH_URL: WEB_URL,
  BETTER_AUTH_SECRET: "e2e-better-auth-secret-0123456789abcdef",
  GITHUB_CLIENT_ID: "Iv1.e2e",
  GITHUB_CLIENT_SECRET: "e2e-client-secret",
  GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GITHUB_APP_ID: "1",
  E2E_GITHUB_INSTALLED_FLAG: INSTALLED_FLAG,
};

export const webEnv = {
  API_URL,
  // A build folder of its own, so building for the test leaves a running `next dev` alone.
  NEXT_DIST_DIR: ".next-e2e",
};
