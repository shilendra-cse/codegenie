import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("reads the model, defaulting to gpt-6-luna", () => {
    expect(parseConfig({ OPENAI_API_KEY: "sk-test" })).toEqual({
      model: "openai:gpt-6-luna",
    });
    expect(
      parseConfig({ OPENAI_API_KEY: "sk-test", AGENT_MODEL: "openai:other" }),
    ).toEqual({ model: "openai:other" });
  });

  it("explains a missing or placeholder key", () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
    expect(() => parseConfig({})).toThrow(/OPENAI_API_KEY is not set/);
    expect(() =>
      parseConfig({ OPENAI_API_KEY: "your-openai-api-key" }),
    ).toThrow(/still the placeholder/);
  });
});
