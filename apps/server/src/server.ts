import { config } from "@/config/index.js";
import { db } from "@/db/index.js";
import { createApp } from "@/app.js";
import { logger } from "./lib/logger";

export const startServer = async () => {
  try {
    // Test database connection on startup
    await db.execute("SELECT 1");
    logger.info("✅ Database connected successfully");

    const app = createApp();

    app.listen(config.server.port, config.server.host, () => {
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
