import type { ModelMessage } from "ai";
import type { UsageSnapshot } from "../model/usage.js";
import type { LimitReached } from "./limits.js";
import type { RunState } from "./run-segment.js";

export type AgentStatus = "succeeded" | "incomplete" | "failed" | "cancelled";

/** Outcome of one agent loop run, whatever the agent's finish tool is. */
export type LoopResult = {
  status: AgentStatus;
  /** Input of the finish tool call; undefined when it wasn't called. */
  finishInput: unknown;
  error?: string;
  limitReached?: LimitReached;
  steps: number;
  durationMs: number;
  model: string;
  usage: UsageSnapshot;
  compactions: number;
  messages: ModelMessage[];
};

export type AgentResult = Omit<LoopResult, "finishInput"> & {
  summary: string | null;
};

export type ResultDetails = Partial<
  Pick<LoopResult, "finishInput" | "error" | "limitReached">
>;

export function buildResult(
  state: RunState,
  run: { startedAt: number; modelId: string },
  status: AgentStatus,
  details: ResultDetails = {},
): LoopResult {
  return {
    status,
    finishInput: details.finishInput,
    error: details.error,
    limitReached: details.limitReached,
    steps: state.steps,
    durationMs: Date.now() - run.startedAt,
    model: run.modelId,
    usage: state.usage.snapshot(),
    compactions: state.compactor.compactions,
    messages: [...state.messages],
  };
}

export function findToolInput(
  messages: ModelMessage[],
  toolName: string,
): unknown {
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-call" && part.toolName === toolName) {
        return part.input ?? {};
      }
    }
  }
  return undefined;
}
