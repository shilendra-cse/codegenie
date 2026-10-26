import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import helmet from "helmet";
import { config, isProduction } from "./config/index.js";
import "./routes"; //this imports all the routes
import { routes } from "./lib/ApiRouter";
import { auth } from "./lib/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { httpLogger } from "./middleware/http-logger.js";
import { rateLimits } from "./middleware/rate-limits.js";
import { logger } from "./lib/logger.js";
import { registerOpenApiDocs } from "./lib/openapi.js";
import { keepRawBody } from "./lib/raw-body.js";

export const createApp = (): express.Express => {
  const app = express();
  app.set("trust proxy", config.server.trustProxy);

  app.use(helmet(config.security.helmet));
  app.use(rateLimits.flood);

  // HTTP Logger middleware
  app.use(httpLogger);

  // Apply CORS middleware
  app.use(cors(config.security.cors));

  app.use(["/api/auth/sign-in", "/api/auth/callback"], rateLimits.signIn);
  // Better Auth must run before express.json() or auth requests hang
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ verify: keepRawBody }));

  // Only for building: nobody outside the team needs the API's map.
  if (!isProduction) registerOpenApiDocs(app);

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
