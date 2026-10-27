import type { Server } from "node:http";
import { pool } from "@/db/index.js";
import { logger } from "./logger.js";
import { redis } from "./redis.js";
import { closeEventHub } from "./events.js";
import { endOpenStreams } from "./sse.js";
import { closeWorkQueue } from "./work-queue.js";

const SHUTDOWN_TIMEOUT_MS = 5000;

let shuttingDown = false;

export function registerGracefulShutdown(getServer: () => Server | null): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Shutting down gracefully");

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out, forcing exit");
      redis.disconnect();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      const server = getServer();
      if (server) {
        const closed = new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
        // Open streams would otherwise hold the server open until the forced exit.
        endOpenStreams();
        await closed;
        logger.info("HTTP server closed");
      }

      await closeWorkQueue();
      await closeEventHub();
      await redis.quit();
      logger.info("Redis connections closed");

      await pool.end();
      logger.info("Database pool closed");

      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
