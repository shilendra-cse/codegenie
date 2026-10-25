import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  API_URL,
  LOG_DIR,
  serverEnv,
  WEB_URL,
  WORKER_HEALTH_PORT,
  webEnv,
} from "./src/environment.js";

const apps = path.join(import.meta.dirname, "..");
// Each server's output goes to its own file in .state/logs, which a failing run points to.
const logTo = (name: string) => `> ${path.join(LOG_DIR, `${name}.log`)} 2>&1`;

export default defineConfig({
  testDir: "tests",
  // One journey, one step after another.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Started in order: the reset runs before the API, and the worker after the database is ready.
  webServer: [
    {
      name: "api",
      command: `tsx src/reset.ts && cd ${path.join(apps, "server")} && tsx src/e2e.ts ${logTo("api")}`,
      url: `${API_URL}/health`,
      env: serverEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      name: "worker",
      command: `tsx src/worker.ts ${logTo("worker")}`,
      url: `http://localhost:${WORKER_HEALTH_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      name: "web",
      command: `cd ${path.join(apps, "web")} && pnpm build ${logTo("web-build")} && pnpm start --port 3100 ${logTo("web")}`,
      url: WEB_URL,
      env: webEnv,
      timeout: 5 * 60_000,
      reuseExistingServer: false,
    },
  ],
});
