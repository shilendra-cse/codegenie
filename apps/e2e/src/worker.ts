// Starts the worker for the test: scripted models and a fake GitHub, real queue, database and Docker sandboxes.
import { createServer } from "node:http";
import { scriptedModel, TEST_MODEL_SPEC } from "@codegenie/agent/testing";
import { startWorker } from "@codegenie/worker";
import { fakeGithubApp } from "@codegenie/worker/testing";
import {
  DATABASE_URL,
  REDIS_URL,
  WEB_URL,
  WORKER_HEALTH_PORT,
} from "./environment.js";
import { e2eDeliveryApi } from "./github-delivery.js";
import { setupScript, taskScript, titleScript } from "./journey.js";

// An empty token: octocat/Hello-World is public, and GitHub refuses a clone with credentials that aren't real.
const { github } = fakeGithubApp("", e2eDeliveryApi());

const worker = await startWorker(
  {
    logLevel: "info",
    prettyLogs: false,
    databaseUrl: DATABASE_URL,
    redisUrl: REDIS_URL,
    model: TEST_MODEL_SPEC.id,
    concurrency: 1,
    sandbox: { provider: "docker" },
    reaperIntervalMs: 60 * 60_000,
    answerTimeoutMs: 5 * 60_000,
    frontendUrl: WEB_URL,
    github: { appId: "", privateKey: "" },
  },
  (level, message, data) =>
    console.log(JSON.stringify({ level, message, ...data })),
  {
    setupModel: scriptedModel(setupScript).resolved,
    taskModel: scriptedModel(taskScript).resolved,
    titleModel: scriptedModel(titleScript).resolved,
    github,
  },
);

// Playwright waits for this before starting the test.
createServer((_req, res) => res.end("ok")).listen(WORKER_HEALTH_PORT);

const stop = () => void worker.stop().then(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
