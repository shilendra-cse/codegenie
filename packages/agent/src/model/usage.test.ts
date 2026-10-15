import { describe, expect, it } from "vitest";
import type { ModelPricing } from "./types.js";
import { UsageTracker } from "./usage.js";

const spec: { pricing: ModelPricing } = {
  pricing: { inputPerMTok: 2, cachedInputPerMTok: 0.5, outputPerMTok: 8 },
};

describe("UsageTracker", () => {
  it("accumulates tokens and prices cached input separately", () => {
    const usage = new UsageTracker(spec.pricing);
    usage.add({
      inputTokens: 600_000,
      cachedInputTokens: 400_000,
      outputTokens: 50_000,
      totalTokens: 650_000,
    });
    usage.add({
      inputTokens: 400_000,
      outputTokens: 50_000,
      totalTokens: 450_000,
    });
    // uncached 600k × $2 + cached 400k × $0.5 + output 100k × $8 = 1.2 + 0.2 + 0.8
    expect(usage.snapshot()).toEqual({
      inputTokens: 1_000_000,
      cachedInputTokens: 400_000,
      outputTokens: 100_000,
      costUsd: 2.2,
    });
  });

  it("treats missing usage fields as zero", () => {
    const usage = new UsageTracker(spec.pricing);
    usage.add({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    });
    expect(usage.costUsd).toBe(0);
  });
});
