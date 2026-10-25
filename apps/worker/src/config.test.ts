import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "./config.js";

const key = {
  OPENAI_API_KEY: "sk-test",
  GITHUB_APP_ID: "123",
  GITHUB_APP_PRIVATE_KEY:
    "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
};

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
      answerTimeoutMs: 30 * 60_000,
      frontendUrl: undefined,
      github: { appId: "123", privateKey: key.GITHUB_APP_PRIVATE_KEY },
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

  it("reads the web app's address without a trailing slash", () => {
    expect(
      parseConfig({ ...key, FRONTEND_URL: "https://codegenie.dev/" })
        .frontendUrl,
    ).toBe("https://codegenie.dev");
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
    [{ ...key, GITHUB_APP_ID: undefined }, "GITHUB_APP_ID is not set"],
    [{ ...key, GITHUB_APP_PRIVATE_KEY: "" }, "GITHUB_APP_PRIVATE_KEY is empty"],
    [{ OPENAI_API_KEY: "your-openai-api-key" }, "still the placeholder"],
    [{ ...key, WORKER_CONCURRENCY: "0" }, "WORKER_CONCURRENCY"],
    [{ ...key, LOG_LEVEL: "loud" }, "LOG_LEVEL"],
    [{ ...key, SANDBOX_PROVIDER: "daytona" }, "DAYTONA_API_KEY is required"],
    [{ ...key, SANDBOX_PROVIDER: "e2b" }, "SANDBOX_PROVIDER"],
    [{ ...key, SANDBOX_RETENTION_HOURS: "-1" }, "SANDBOX_RETENTION_HOURS"],
    [{ ...key, REAPER_INTERVAL_MINUTES: "0" }, "REAPER_INTERVAL_MINUTES"],
    [{ ...key, FRONTEND_URL: "localhost:3000" }, "FRONTEND_URL"],
  ])("rejects %j", (env, message) => {
    expect(() => parseConfig(env)).toThrow(ConfigError);
    expect(() => parseConfig(env)).toThrow(message);
  });
});
