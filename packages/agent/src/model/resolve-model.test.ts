import { describe, expect, it } from "vitest";
import { resolveModel } from "./resolve-model.js";
import type { ModelSpec } from "./types.js";

const spec: ModelSpec = {
  id: "openai:test-model",
  label: "Test",
  contextWindow: 100_000,
  pricing: { inputPerMTok: 2, cachedInputPerMTok: 0.5, outputPerMTok: 8 },
};

describe("resolveModel", () => {
  it("resolves catalog models through the provider registry", () => {
    const resolved = resolveModel("openai:test-model", [spec]);
    expect(resolved.spec).toBe(spec);
    expect((resolved.languageModel as { modelId: string }).modelId).toBe(
      "test-model",
    );
  });

  it("rejects models that are not in the catalog", () => {
    expect(() => resolveModel("openai:unknown", [spec])).toThrow(
      /not in the model catalog \(known: openai:test-model\)/,
    );
    expect(() => resolveModel("openai:anything", [])).toThrow(/known: none/);
  });
});
