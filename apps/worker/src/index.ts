import { config as loadDotenv } from "dotenv";
import { ConfigError, ENV_FILE, parseConfig } from "./config.js";
import { createLog } from "./lib/logger.js";
import { startWorker } from "./start-worker.js";

async function main() {
  loadDotenv({ path: ENV_FILE, quiet: true });
  const config = parseConfig(process.env);
  const log = createLog({ level: config.logLevel, pretty: config.prettyLogs });

  const worker = await startWorker(config, log);
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
    await worker.stop();
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
