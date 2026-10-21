import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "./config.js";

const key = { OPENAI_API_KEY: "sk-test" };

describe("parseConfig", () => {
  it("uses the development services by default", () => {
    expect(parseConfig(key)).toEqual({
      logLevel: "info",
      prettyLogs: true,
      databaseUrl:
        "postgresql://codegenie_user:codegenie_password@localhost:5439/codegenie_db",
      redisUrl: "redis://localhost:6380",
      model: "openai:gpt-6-luna",
      concurrency: 3,
      sandbox: { provider: "docker" },
      reaperIntervalMs: 5 * 60_000,
    });
  });

  it("prefers DATABASE_URL over the DB_* parts", () => {
    expect(
      parseConfig({
        ...key,
        DATABASE_URL: "postgresql://u:p@db:5432/x",
        DB_HOST: "ignored",
      }).databaseUrl,
    ).toBe("postgresql://u:p@db:5432/x");
  });

  it("reads concurrency and logs plainly outside development", () => {
    expect(
      parseConfig({ ...key, WORKER_CONCURRENCY: "5", NODE_ENV: "production" }),
    ).toMatchObject({ concurrency: 5, prettyLogs: false });
  });

  it("connects to Daytona when it's the sandbox provider", () => {
    expect(
      parseConfig({
        ...key,
        SANDBOX_PROVIDER: "daytona",
        DAYTONA_API_KEY: "dtn_test",
        DAYTONA_TARGET: "eu",
      }).sandbox,
    ).toEqual({
      provider: "daytona",
      connection: { apiKey: "dtn_test", apiUrl: undefined, target: "eu" },
      retentionHours: 4,
    });
  });

  it.each([
    [{}, "OPENAI_API_KEY is not set"],
    [{ OPENAI_API_KEY: "your-openai-api-key" }, "still the placeholder"],
    [{ ...key, WORKER_CONCURRENCY: "0" }, "WORKER_CONCURRENCY"],
    [{ ...key, LOG_LEVEL: "loud" }, "LOG_LEVEL"],
    [{ ...key, SANDBOX_PROVIDER: "daytona" }, "DAYTONA_API_KEY is required"],
    [{ ...key, SANDBOX_PROVIDER: "e2b" }, "SANDBOX_PROVIDER"],
    [{ ...key, SANDBOX_RETENTION_HOURS: "-1" }, "SANDBOX_RETENTION_HOURS"],
    [{ ...key, REAPER_INTERVAL_MINUTES: "0" }, "REAPER_INTERVAL_MINUTES"],
  ])("rejects %j", (env, message) => {
    expect(() => parseConfig(env)).toThrow(ConfigError);
    expect(() => parseConfig(env)).toThrow(message);
  });
});
