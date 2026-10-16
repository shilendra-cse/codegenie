import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, type LanguageModel } from "ai";
import { findModelSpec, MODEL_CATALOG } from "./catalog.js";
import type { ModelSpec } from "./types.js";

export type ResolvedModel = {
  spec: ModelSpec;
  languageModel: LanguageModel;
};

const registry = createProviderRegistry({
  openai: createOpenAI(),
});

export function resolveModel(
  id: string,
  catalog: ModelSpec[] = MODEL_CATALOG,
): ResolvedModel {
  const spec = findModelSpec(id, catalog);
  if (!spec) {
    const known = catalog.map((s) => s.id).join(", ") || "none";
    throw new Error(
      `Model "${id}" is not in the model catalog (known: ${known}). ` +
        "Add it to packages/agent/src/model/catalog.ts with its context window and prices.",
    );
  }
  return {
    spec,
    languageModel: registry.languageModel(id as `openai:${string}`),
  };
}
