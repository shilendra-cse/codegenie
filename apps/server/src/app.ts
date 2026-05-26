import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { config } from "./config/index.js";
import "./routes"; //this imports all the routes
import { routes } from "./lib/ApiRouter";
import { auth } from "./lib/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { logger } from "./lib/logger.js";
import { registerOpenApiDocs } from "./lib/openapi.js";

export const createApp = (): express.Express => {
  const app = express();

  // HTTP Logger middleware
  app.use(httpLogger);

  // Apply CORS middleware
  app.use(cors(config.security.cors));

  // Better Auth must run before express.json() or auth requests hang
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  registerOpenApiDocs(app);

  // Health check endpoint
  app.get("/health", (_req, res) => {
    logger.info("Health check endpoint hit");
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.server.environment,
    });
  });

  //setting up routes
  app.use("/api", routes);

  // Error handling middleware
  app.use(errorHandler);

  return app;
};
