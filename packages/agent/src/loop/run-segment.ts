import {
  hasToolCall,
  stepCountIs,
  streamText,
  type ModelMessage,
  type StopCondition,
  type ToolChoice,
} from "ai";
import type { ResolvedModel } from "../model/resolve-model.js";
import type { UsageTracker } from "../model/usage.js";
import type { AgentTools } from "../tools/index.js";
import { findFinishSummary } from "./agent-result.js";
import type { Compactor } from "./compaction.js";
import { isInfrastructureError } from "./errors.js";
import { toJobEvent, type Emit } from "./events.js";

/** Provider errors (rate limits, 5xx) are retried by the AI SDK this many times. */
const MAX_MODEL_RETRIES = 3;

/** Mutable state of one agent run, shared by all its segments. */
export type RunState = {
  /** Task plus every completed step's messages; only ever appended to. */
  messages: ModelMessage[];
  steps: number;
  usage: UsageTracker;
  compactor: Compactor;
};

/** Fixed for the whole run. */
export type RunEnvironment = {
  runId: string;
  model: ResolvedModel;
  system: string;
  tools: AgentTools;
  emit: Emit;
  maxCostUsd: number;
  /** Aborted when a tool hits an infrastructure error. */
  infraAbort: AbortController;
};

export type SegmentParams = {
  maxSteps: number;
  signal: AbortSignal;
  toolChoice?: ToolChoice<AgentTools>;
  /** Stop when the run's cost limit is reached (off for the final wrap-up step). */
  costLimit: boolean;
};

export type SegmentOutcome = {
  finishSummary: string | null;
  infraError?: unknown;
  modelError?: unknown;
};

/**
 * One streamText call: the model takes steps (tool calls) until it calls finish_task,
 * stops on its own, hits a stop condition, or the signal aborts. Streams events and
 * appends the messages of completed steps to the run state.
 */
export async function runSegment(
  state: RunState,
  env: RunEnvironment,
  params: SegmentParams,
): Promise<SegmentOutcome> {
  const outcome: SegmentOutcome = { finishSummary: null };
  // Messages of completed steps; survives an abort mid-step.
  let completed: ModelMessage[] = [];

  const stopWhen: StopCondition<AgentTools>[] = [
    hasToolCall("finish_task"),
    stepCountIs(params.maxSteps),
  ];
  if (params.costLimit) {
    stopWhen.push(() => state.usage.costUsd >= env.maxCostUsd);
  }

  const result = streamText({
    model: env.model.languageModel,
    system: env.system,
    messages: [...state.messages],
    tools: env.tools,
    toolChoice: params.toolChoice,
    abortSignal: params.signal,
    maxRetries: MAX_MODEL_RETRIES,
    stopWhen,
    prepareStep: ({ messages: history }) => ({
      messages: state.compactor.apply(history),
    }),
    onStepFinish: (step) => {
      state.steps += 1;
      state.usage.add(step.usage);
      completed = step.response.messages;
    },
  });

  for await (const part of result.fullStream) {
    if (part.type === "tool-error" && isInfrastructureError(part.error)) {
      // The SDK would hand this to the model; the model can't fix a dead sandbox.
      outcome.infraError = part.error;
      env.infraAbort.abort();
    } else if (part.type === "error") {
      outcome.modelError = part.error;
    }
    const event = toJobEvent(part, env.runId);
    if (event) env.emit(event);
  }

  state.messages.push(...completed);
  outcome.finishSummary = findFinishSummary(completed);
  return outcome;
}
