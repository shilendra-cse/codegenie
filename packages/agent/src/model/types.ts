export type ModelPricing = {
  inputPerMTok: number;
  cachedInputPerMTok: number;
  outputPerMTok: number;
};

export type ModelSpec = {
  id: string;
  label: string;
  contextWindow: number;
  pricing: ModelPricing;
};
