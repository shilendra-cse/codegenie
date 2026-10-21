import { resolveModel } from "@codegenie/agent";
import { createDb } from "@codegenie/db";
import { createGithubApp } from "@codegenie/github";
import {
  connectSandbox,
  createSandbox,
  type SandboxLabels,
} from "@codegenie/sandbox";
import { WORK_QUEUE } from "@codegenie/shared";
import { Queue } from "bullmq";
import { config as loadDotenv } from "dotenv";
import { Redis } from "ioredis";
import { ConfigError, ENV_FILE, parseConfig } from "./config.js";
import { startConsumer } from "./consumer.js";
import { handleOnboardProject } from "./handlers/onboard-project.js";
import { handleRunTask } from "./handlers/run-task.js";
import { createLog } from "./lib/logger.js";
import { handleReap } from "./reaper/reap.js";
import { scheduleReaper } from "./reaper/schedule.js";

async function main() {
  loadDotenv({ path: ENV_FILE, quiet: true });
  const config = parseConfig(process.env);
  const log = createLog({ level: config.logLevel, pretty: config.prettyLogs });

  const { db, pool } = createDb(config.databaseUrl);
  // Without a listener, an idle connection dropping (e.g. Postgres restarting) crashes the process.
  pool.on("error", (error) =>
    log("error", "Database connection error", { error: error.message }),
  );

  const connect = (name: string) => {
    const redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      connectionName: `codegenie-worker-${name}`,
    });
    redis.on("error", (error) =>
      log("error", "Redis connection error", { name, error: error.message }),
    );
    return redis;
  };
  const redis = {
    queue: connect("queue"),
    publisher: connect("publisher"),
    subscriber: connect("subscriber"),
    scheduler: connect("scheduler"),
  };
  const queue = new Queue(WORK_QUEUE, { connection: redis.scheduler });

  const deps = {
    db,
    publisher: redis.publisher,
    log,
    model: resolveModel(config.model),
    createSandbox: (labels: SandboxLabels) =>
      createSandbox({ ...config.sandbox, labels }),
    github: createGithubApp(config.github),
  };
  const consumer = await startConsumer({
    connection: redis.queue,
    subscriber: redis.subscriber,
    concurrency: config.concurrency,
    log,
    handlers: {
      "run-task": (data, signal) => handleRunTask(deps, data, signal),
      "onboard-project": (data, signal) =>
        handleOnboardProject(deps, data, signal),
      reap: () =>
        handleReap({
          ...deps,
          queue,
          connectSandbox: (id) => connectSandbox({ ...config.sandbox, id }),
        }),
    },
  });
  await scheduleReaper(queue, config.reaperIntervalMs);
  log("info", "Worker started", {
    model: config.model,
    concurrency: config.concurrency,
    sandbox: config.sandbox.provider,
  });

  let stoppingSince: number | null = null;
  const stop = async (signal: NodeJS.Signals) => {
    if (stoppingSince !== null) {
      // Wrappers like pnpm pass a Ctrl-C on as well, so the same press can arrive twice within milliseconds.
      if (Date.now() - stoppingSince < 1000) return;
      log("warn", "Stopping now; work in progress is left to the reaper", {
        signal,
      });
      process.exit(1);
    }
    stoppingSince = Date.now();
    log("info", "Stopping after the work in progress (again to stop now)", {
      signal,
    });
    await consumer.close();
    await queue.close();
    await Promise.all(Object.values(redis).map((r) => r.quit()));
    await pool.end();
    log("info", "Worker stopped");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigError
      ? `Invalid worker configuration:\n${error.message}`
      : error,
  );
  process.exit(1);
});
