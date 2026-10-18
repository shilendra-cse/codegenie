import { describe, expect, it } from "vitest";
import { EnvironmentConfigError, parseEnvironmentConfig } from "./config.js";

const valid = {
  version: 1,
  steps: [{ name: "install", cwd: ".", command: "npm ci" }],
  checks: [{ name: "test", cwd: ".", command: "npm run test" }],
  meta: { source: "detected", createdAt: "2026-10-17T00:00:00.000Z" },
};

describe("parseEnvironmentConfig", () => {
  it("accepts a valid config and fills defaults", () => {
    expect(parseEnvironmentConfig(valid)).toEqual({
      ...valid,
      meta: { ...valid.meta, decisions: [] },
    });
  });

  it("explains every problem with its location", () => {
    const run = () =>
      parseEnvironmentConfig({
        version: 2,
        steps: [{ name: "install", cwd: ".", command: "  " }],
        checks: [{ name: "deploy", cwd: ".", command: "x" }],
        meta: { source: "detected", createdAt: "" },
      });
    expect(run).toThrow(EnvironmentConfigError);
    expect(run).toThrow(/version:/);
    expect(run).toThrow(/steps\.0\.command:/);
    expect(run).toThrow(/checks\.0\.name:/);
  });

  it("rejects things that aren't configs at all", () => {
    expect(() => parseEnvironmentConfig("npm ci")).toThrow(/\(root\)/);
  });
});
