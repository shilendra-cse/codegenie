import type { ModelSpec } from "./types.js";

/**
 * Models the platform may run. Only models listed here can be resolved, because cost
 * limits and compaction need their prices and context window.
 *
 * Add an entry with values from the provider's model and pricing pages, e.g.:
 *
 *   {
 *     id: "openai:<model-id>",
 *     label: "OpenAI <model name>",
 *     contextWindow: 400_000,
 *     pricing: { inputPerMTok: 1.25, cachedInputPerMTok: 0.125, outputPerMTok: 10 },
 *   },
 *
 * (Numbers above are illustrative only; use the provider's current values.)
 */
export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: "openai:gpt-6-luna",
    label: "OpenAI GPT-6 Luna",
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
