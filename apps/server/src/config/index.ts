import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import "dotenv/config";
import { logger } from "@/lib/logger";

// Schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default(4000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.string().transform(Number).default(5439),
  DB_NAME: z.string().default("codegenie_db"),
  DB_USER: z.string().default("codegenie_user"),
  DB_PASSWORD: z.string().default("codegenie_password"),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),

  FRONTEND_URL: z.string().optional(),

  JWT_SECRET: z.string().optional(),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).default(6379),
  REDIS_PASSWORD: z.string().default("codegenie_password"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  WORKSPACES_ROOT: z.string().min(1),
});

// Get environment-specific values
const getEnvValue = <T>(
  values: { development?: T; test?: T; production?: T },
  fallback: T,
): T => {
  const env = process.env.NODE_ENV as "development" | "test" | "production";
  return values[env] ?? fallback;
};

// Parse env
const parseEnv = () => {
  try {
    const env = envSchema.parse(process.env);
    const workspacesRoot = path.resolve(env.WORKSPACES_ROOT);

    if (env.NODE_ENV === "production" && !fs.existsSync(workspacesRoot)) {
      logger.error(`WORKSPACES_ROOT does not exist: ${workspacesRoot}`);
      throw new Error(`WORKSPACES_ROOT does not exist: ${workspacesRoot}`);
    }

    return {
      server: {
        port: env.PORT,
        host: env.HOST,
        environment: env.NODE_ENV,
      },
      client: {
        url: env.FRONTEND_URL,
      },
      database: {
        url:
          env.DATABASE_URL ||
          `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
        host: env.DB_HOST,
        port: env.DB_PORT,
        name: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      },
      security: {
        helmet: {
          contentSecurityPolicy:
            env.NODE_ENV === "production"
              ? {
                  directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                  },
                }
              : false,
        },
        cors: {
          origin:
            env.NODE_ENV === "development"
              ? ["http://localhost:3000", "http://localhost:5173"]
              : env.NODE_ENV === "production" && env.FRONTEND_URL
                ? env.FRONTEND_URL
                : false,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
        rateLimit: {
          max: getEnvValue(
            { development: 10000, test: 1000, production: 5000 },
            5000,
          ),
          timeWindow: "15 minutes" as const,
        },
        jwt: {
          secret: getEnvValue(
            {
              development: "development-secret",
              test: "test-secret",
              production: "production-secret",
            },
            "development-secret",
          ),
        },
      },
      logging: {
        level: env.LOG_LEVEL,
      },
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        url: env.REDIS_URL,
      },
      workspaces: {
        root: workspacesRoot,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");

      console.error("Invalid environment variables:\n", issues);
      process.exit(1);
    }
    throw error;
  }
};

// Export validated config
export const config = parseEnv();

// Export inferred type for use elsewhere
export type Config = typeof config;

// Helper to check environment
export const isDevelopment = config.server.environment === "development";
export const isProduction = config.server.environment === "production";
export const isTest = config.server.environment === "test";
