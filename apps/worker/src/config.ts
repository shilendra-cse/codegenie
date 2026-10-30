import path from "node:path";
import type { DaytonaConnection, E2BConnection } from "@hobai/sandbox";
import { DEFAULT_AGENT_MODEL } from "@hobai/shared";
import { z } from "zod";
import { SHORT_NAME } from "@hobai/shared/brand";

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
    DB_NAME: z.string().default(`${SHORT_NAME}_db`),
    DB_USER: z.string().default(`${SHORT_NAME}_user`),
    DB_PASSWORD: z.string().default(`${SHORT_NAME}_password`),

    REDIS_URL: z.string().default("redis://localhost:6380"),

    OPENAI_API_KEY: z
      .string({ error: `OPENAI_API_KEY is not set. Add it to ${ENV_FILE}.` })
      .min(1, `OPENAI_API_KEY is empty. Add it to ${ENV_FILE}.`)
      .refine((key) => key !== PLACEHOLDER_KEY, {
        message: `OPENAI_API_KEY is still the placeholder. Set your key in ${ENV_FILE}.`,
      }),
    AGENT_MODEL: z.string().min(1).default(DEFAULT_AGENT_MODEL),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(3),

    SANDBOX_PROVIDER: z.enum(["docker", "daytona", "e2b"]).default("docker"),
    DAYTONA_API_KEY: z.string().min(1).optional(),
    DAYTONA_API_URL: z.string().min(1).optional(),
    DAYTONA_TARGET: z.string().min(1).optional(),
    E2B_API_KEY: z.string().min(1).optional(),
    SANDBOX_RETENTION_HOURS: z.coerce.number().min(0).default(4),
    REAPER_INTERVAL_MINUTES: z.coerce.number().min(1).default(5),
    ONBOARDING_ANSWER_TIMEOUT_MINUTES: z.coerce.number().min(1).default(30),
    FRONTEND_URL: z.url({ protocol: /^https?$/ }).optional(),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(0).default(4100),

    GITHUB_APP_ID: z
      .string({ error: `GITHUB_APP_ID is not set. Add it to ${ENV_FILE}.` })
      .min(1, `GITHUB_APP_ID is empty. Add it to ${ENV_FILE}.`),
    GITHUB_APP_PRIVATE_KEY: z
      .string({
        error: `GITHUB_APP_PRIVATE_KEY is not set. Add it to ${ENV_FILE}.`,
      })
      .min(1, `GITHUB_APP_PRIVATE_KEY is empty. Add it to ${ENV_FILE}.`),
  })
  .refine((e) => e.SANDBOX_PROVIDER !== "daytona" || e.DAYTONA_API_KEY, {
    path: ["DAYTONA_API_KEY"],
    message: `DAYTONA_API_KEY is required when SANDBOX_PROVIDER=daytona. Add it to ${ENV_FILE}.`,
  })
  .refine((e) => e.SANDBOX_PROVIDER !== "e2b" || e.E2B_API_KEY, {
    path: ["E2B_API_KEY"],
    message: `E2B_API_KEY is required when SANDBOX_PROVIDER=e2b. Add it to ${ENV_FILE}.`,
  });

type Env = z.infer<typeof schema>;

export type SandboxConfig =
  | { provider: "docker" }
  | {
      provider: "daytona";
      connection: DaytonaConnection;
      retentionHours: number;
    }
  | { provider: "e2b"; connection: E2BConnection };

export type WorkerConfig = {
  logLevel: string;
  prettyLogs: boolean;
  databaseUrl: string;
  redisUrl: string;
  model: string;
  concurrency: number;
  sandbox: SandboxConfig;
  reaperIntervalMs: number;
  answerTimeoutMs: number;
  frontendUrl: string | undefined;
  healthPort: number;
  github: { appId: string; privateKey: string };
};

export class ConfigError extends Error {}

function sandboxConfig(e: Env): SandboxConfig {
  switch (e.SANDBOX_PROVIDER) {
    case "docker":
      return { provider: "docker" };
    case "daytona":
      return {
        provider: "daytona",
        connection: {
          apiKey: e.DAYTONA_API_KEY!,
          apiUrl: e.DAYTONA_API_URL,
          target: e.DAYTONA_TARGET,
        },
        retentionHours: e.SANDBOX_RETENTION_HOURS,
      };
    case "e2b":
      return { provider: "e2b", connection: { apiKey: e.E2B_API_KEY! } };
  }
}

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
    sandbox: sandboxConfig(e),
    reaperIntervalMs: e.REAPER_INTERVAL_MINUTES * 60_000,
    answerTimeoutMs: e.ONBOARDING_ANSWER_TIMEOUT_MINUTES * 60_000,
    frontendUrl: e.FRONTEND_URL?.replace(/\/+$/, ""),
    healthPort: e.WORKER_HEALTH_PORT,
    github: { appId: e.GITHUB_APP_ID, privateKey: e.GITHUB_APP_PRIVATE_KEY },
  };
}
