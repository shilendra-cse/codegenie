import {
  hasToolCall,
  stepCountIs,
  streamText,
  type ModelMessage,
  type StopCondition,
  type ToolChoice,
  type ToolSet,
} from "ai";
import type { ResolvedModel } from "../model/resolve-model.js";
import type { UsageTracker } from "../model/usage.js";
import { findToolInput } from "./agent-result.js";
import type { Compactor } from "./compaction.js";
import { isInfrastructureError } from "./errors.js";
import { toRunEvent, type Emit } from "./events.js";

const MAX_MODEL_RETRIES = 3;

export type RunState = {
  messages: ModelMessage[];
  steps: number;
  usage: UsageTracker;
  compactor: Compactor;
};

export type RunEnvironment = {
  runId: string;
  model: ResolvedModel;
  system: string;
  tools: ToolSet;
  /** The tool whose call ends the run; its input is the run's answer. */
  finishTool: string;
  emit: Emit;
  maxCostUsd: number;
  infraAbort: AbortController;
};

export type SegmentParams = {
  maxSteps: number;
  signal: AbortSignal;
  toolChoice?: ToolChoice<ToolSet>;
  costLimit: boolean;
};

export type SegmentOutcome = {
  /** Input of the finish tool call; undefined when it wasn't called. */
  finishInput: unknown;
  infraError?: unknown;
  modelError?: unknown;
};

export async function runSegment(
  state: RunState,
  env: RunEnvironment,
  params: SegmentParams,
): Promise<SegmentOutcome> {
  const outcome: SegmentOutcome = { finishInput: undefined };
  let completed: ModelMessage[] = [];

  const stopWhen: StopCondition<ToolSet>[] = [
    hasToolCall(env.finishTool),
    stepCountIs(params.maxSteps),
    // Checked by the SDK before the next model call; the abort below can arrive after that call has started.
    ({ steps }) =>
      steps
        .at(-1)!
        .content.some(
          (part) =>
            part.type === "tool-error" && isInfrastructureError(part.error),
        ),
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
      env.emit({
        type: "agent_step",
        runId: env.runId,
        ts: new Date().toISOString(),
        steps: state.steps,
        costUsd: state.usage.costUsd,
      });
    },
  });

  for await (const part of result.fullStream) {
    // The SDK would pass this to the model, which can't fix a dead sandbox: stop the run instead.
    if (part.type === "tool-error" && isInfrastructureError(part.error)) {
      outcome.infraError = part.error;
      env.infraAbort.abort();
    } else if (part.type === "error") {
      outcome.modelError = part.error;
    }
    const event = toRunEvent(part, env.runId);
    if (event) env.emit(event);
  }

  state.messages.push(...completed);
  outcome.finishInput = findToolInput(completed, env.finishTool);
  return outcome;
}
