import path from "node:path";
import type { DaytonaConnection } from "@codegenie/sandbox";
import { z } from "zod";

export const ENV_FILE = path.join(import.meta.dirname, "..", ".env");
const PLACEHOLDER_KEY = "your-openai-api-key";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    DATABASE_URL: z.string().min(1).optional(),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().int().default(5439),
    DB_NAME: z.string().default("codegenie_db"),
    DB_USER: z.string().default("codegenie_user"),
    DB_PASSWORD: z.string().default("codegenie_password"),

    REDIS_URL: z.string().default("redis://localhost:6380"),

    OPENAI_API_KEY: z
      .string({ error: `OPENAI_API_KEY is not set. Add it to ${ENV_FILE}.` })
      .min(1, `OPENAI_API_KEY is empty. Add it to ${ENV_FILE}.`)
      .refine((key) => key !== PLACEHOLDER_KEY, {
        message: `OPENAI_API_KEY is still the placeholder. Set your key in ${ENV_FILE}.`,
      }),
    AGENT_MODEL: z.string().min(1).default("openai:gpt-6-luna"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(3),

    SANDBOX_PROVIDER: z.enum(["docker", "daytona"]).default("docker"),
    DAYTONA_API_KEY: z.string().min(1).optional(),
    DAYTONA_API_URL: z.string().min(1).optional(),
    DAYTONA_TARGET: z.string().min(1).optional(),
  })
  .refine((e) => e.SANDBOX_PROVIDER !== "daytona" || e.DAYTONA_API_KEY, {
    path: ["DAYTONA_API_KEY"],
    message: `DAYTONA_API_KEY is required when SANDBOX_PROVIDER=daytona. Add it to ${ENV_FILE}.`,
  });

export type SandboxConfig =
  | { provider: "docker" }
  | { provider: "daytona"; connection: DaytonaConnection };

export type WorkerConfig = {
  logLevel: string;
  prettyLogs: boolean;
  databaseUrl: string;
  redisUrl: string;
  model: string;
  concurrency: number;
  sandbox: SandboxConfig;
};

export class ConfigError extends Error {}

export function parseConfig(
  env: Record<string, string | undefined>,
): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("\n"),
    );
  }
  const e = parsed.data;
  return {
    logLevel: e.LOG_LEVEL,
    prettyLogs: e.NODE_ENV === "development",
    databaseUrl:
      e.DATABASE_URL ??
      `postgresql://${e.DB_USER}:${e.DB_PASSWORD}@${e.DB_HOST}:${e.DB_PORT}/${e.DB_NAME}`,
    redisUrl: e.REDIS_URL,
    model: e.AGENT_MODEL,
    concurrency: e.WORKER_CONCURRENCY,
    sandbox:
      e.SANDBOX_PROVIDER === "daytona"
        ? {
            provider: "daytona",
            connection: {
              apiKey: e.DAYTONA_API_KEY!,
              apiUrl: e.DAYTONA_API_URL,
              target: e.DAYTONA_TARGET,
            },
          }
        : { provider: "docker" },
  };
}
