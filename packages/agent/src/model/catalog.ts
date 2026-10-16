import type { ModelSpec } from "./types.js";

export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: "openai:gpt-6-luna",
    label: "OpenAI GPT-6 Luna",
    // Real window is 1.05M, but prompts over 272K are billed at double rates.
    contextWindow: 272_000,
    pricing: {
      inputPerMTok: 0.1,
      cachedInputPerMTok: 0.01,
      outputPerMTok: 0.5,
    },
  },
];

export function findModelSpec(
  id: string,
  catalog: ModelSpec[] = MODEL_CATALOG,
): ModelSpec | undefined {
  return catalog.find((spec) => spec.id === id);
}
