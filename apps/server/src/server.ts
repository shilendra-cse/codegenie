import type { Server } from "node:http";
import { config } from "@/config/index.js";
import { db } from "@/db/index.js";
import { createApp } from "@/app.js";
import { logger } from "./lib/logger.js";
import { redis } from "./lib/redis.js";

let httpServer: Server | null = null;

export function getHttpServer(): Server | null {
  return httpServer;
}

export const startServer = async (): Promise<void> => {
  try {
    await db.execute("SELECT 1");
    logger.info("✅ Database connected successfully");

    await redis.ping();
    logger.info("✅ Redis connected successfully");

    const app = createApp();

    httpServer = app.listen(config.server.port, config.server.host, () => {
      logger.info(
        `🚀 Server running on http://${config.server.host}:${config.server.port}`,
      );
      logger.info(`📊 Environment: ${config.server.environment}`);
      logger.info(
        `🔗 Health check: http://${config.server.host}:${config.server.port}/health`,
      );
    });
  } catch (error) {
    logger.error({ error }, "❌ Failed to start server:");
    process.exit(1);
  }
};
