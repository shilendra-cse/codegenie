import type { LanguageModelUsage } from "ai";
import type { ModelPricing } from "./types.js";

export type UsageSnapshot = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export class UsageTracker {
  private inputTokens = 0;
  private cachedInputTokens = 0;
  private outputTokens = 0;

  constructor(private readonly pricing: ModelPricing) {}

  add(usage: LanguageModelUsage) {
    this.inputTokens += usage.inputTokens ?? 0;
    this.cachedInputTokens += usage.cachedInputTokens ?? 0;
    this.outputTokens += usage.outputTokens ?? 0;
  }

  get costUsd() {
    // inputTokens includes cached tokens, which are billed at the cached rate.
    const uncached = Math.max(0, this.inputTokens - this.cachedInputTokens);
    return (
      (uncached * this.pricing.inputPerMTok +
        this.cachedInputTokens * this.pricing.cachedInputPerMTok +
        this.outputTokens * this.pricing.outputPerMTok) /
      1_000_000
    );
  }

  snapshot(): UsageSnapshot {
    return {
      inputTokens: this.inputTokens,
      cachedInputTokens: this.cachedInputTokens,
      outputTokens: this.outputTokens,
      costUsd: this.costUsd,
    };
  }
}
