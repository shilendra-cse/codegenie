/** Prices in USD per million tokens. */
export type ModelPricing = {
  inputPerMTok: number;
  /** Price for input tokens served from the provider's prompt cache. */
  cachedInputPerMTok: number;
  outputPerMTok: number;
};

export type ModelSpec = {
  /** "<provider>:<model id>", e.g. "openai:<model-id>". */
  id: string;
  label: string;
  /** Maximum prompt size in tokens; drives context compaction. */
  contextWindow: number;
  pricing: ModelPricing;
};
