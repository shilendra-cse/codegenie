import { simulateReadableStream, type LanguageModel } from "ai";
import type { ModelSpec } from "../model/types.js";
import type { ResolvedModel } from "../model/resolve-model.js";

/** The provider-level model interface the AI SDK calls (LanguageModelV2). */
type ProviderModel = Exclude<LanguageModel, string>;
export type StreamCallOptions = Parameters<ProviderModel["doStream"]>[0];
type StreamResult = Awaited<ReturnType<ProviderModel["doStream"]>>;
type StreamChunk =
  StreamResult["stream"] extends ReadableStream<infer C> ? C : never;

/** One scripted model response. */
export type ScriptedStep = {
  text?: string;
  toolCalls?: { toolName: string; input: unknown }[];
  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  };
  /** Delay between stream chunks, to simulate a slow model. */
  delayMs?: number;
  /** Throw instead of responding (simulates a provider error). */
  error?: Error;
};

/** Prices chosen so costs are easy to compute in tests: $1 / 1M input tokens. */
export const TEST_MODEL_SPEC: ModelSpec = {
  id: "test:scripted",
  label: "Scripted test model",
  contextWindow: 100_000,
  pricing: { inputPerMTok: 1, cachedInputPerMTok: 0.1, outputPerMTok: 4 },
};

/**
 * A fake LLM that replays a script. Pass an array (one entry per model call) or a
 * function of the call index for open-ended scripts. No network, no cost.
 * Implements the provider interface directly (the SDK's own mock needs extra test-only packages).
 */
export function scriptedModel(
  script: ScriptedStep[] | ((callIndex: number) => ScriptedStep),
  spec: ModelSpec = TEST_MODEL_SPEC,
) {
  let callIndex = 0;
  let toolCallCounter = 0;

  const doStreamCalls: StreamCallOptions[] = [];

  const model = {
    specificationVersion: "v2" as const,
    provider: "test",
    modelId: spec.id,
    supportedUrls: {},
    doStreamCalls,
    doGenerate: async () => {
      throw new Error("Scripted model only supports streaming");
    },
    doStream: async (options: StreamCallOptions): Promise<StreamResult> => {
      doStreamCalls.push(options);
      const index = callIndex++;
      const step = typeof script === "function" ? script(index) : script[index];
      if (!step) {
        throw new Error(`Scripted model has no response for call #${index}`);
      }
      if (step.error) throw step.error;

      const chunks: StreamChunk[] = [{ type: "stream-start", warnings: [] }];
      if (step.text) {
        chunks.push(
          { type: "text-start", id: "text" },
          { type: "text-delta", id: "text", delta: step.text },
          { type: "text-end", id: "text" },
        );
      }
      for (const call of step.toolCalls ?? []) {
        toolCallCounter += 1;
        chunks.push({
          type: "tool-call",
          toolCallId: `call-${toolCallCounter}`,
          toolName: call.toolName,
          input: JSON.stringify(call.input),
        });
      }
      const inputTokens = step.usage?.inputTokens ?? 100;
      const outputTokens = step.usage?.outputTokens ?? 20;
      chunks.push({
        type: "finish",
        finishReason: step.toolCalls?.length ? "tool-calls" : "stop",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cachedInputTokens: step.usage?.cachedInputTokens ?? 0,
        },
      });

      return {
        stream: simulateReadableStream({
          chunks,
          chunkDelayInMs: step.delayMs ?? 0,
        }),
      };
    },
  } satisfies ProviderModel & { doStreamCalls: StreamCallOptions[] };

  const resolved: ResolvedModel = { spec, languageModel: model };
  return { model, resolved };
}
