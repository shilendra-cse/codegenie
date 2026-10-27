import { config as loadDotenv } from "dotenv";
import { ConfigError, ENV_FILE, parseConfig } from "./config.js";
import { startHealthServer } from "./lib/health-server.js";
import { createLog } from "./lib/logger.js";
import { createStopHandler } from "./lib/stop-signals.js";
import { startWorker } from "./start-worker.js";

async function main() {
  loadDotenv({ path: ENV_FILE, quiet: true });
  const config = parseConfig(process.env);
  const log = createLog({ level: config.logLevel, pretty: config.prettyLogs });
  // Node exits on one by default, and that would end every run in progress with it.
  process.on("unhandledRejection", (reason) =>
    log("error", "Unhandled promise rejection", { error: String(reason) }),
  );

  const worker = await startWorker(config, log);
  const health = await startHealthServer(config.healthPort, worker.check, log);
  log("info", "Worker started", {
    model: config.model,
    concurrency: config.concurrency,
    sandbox: config.sandbox.provider,
  });

  const stop = createStopHandler({
    log,
    stop: async () => {
      await worker.stop();
      await health.close();
    },
  });
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
