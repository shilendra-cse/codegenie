import type { ModelMessage } from "ai";
import type { UsageSnapshot } from "../model/usage.js";
import type { LimitReached } from "./limits.js";
import type { RunState } from "./run-segment.js";

export type AgentStatus = "succeeded" | "incomplete" | "failed" | "cancelled";

export type AgentResult = {
  status: AgentStatus;
  /** finish_task summary; present for succeeded and usually for incomplete runs. */
  summary: string | null;
  /** Why the run failed or ended early. */
  error?: string;
  limitReached?: LimitReached;
  steps: number;
  durationMs: number;
  model: string;
  usage: UsageSnapshot;
  compactions: number;
  /** Full transcript (task + model/tool messages), for debugging and follow-ups. */
  messages: ModelMessage[];
};

export type ResultDetails = Partial<
  Pick<AgentResult, "summary" | "error" | "limitReached">
>;

export function buildResult(
  state: RunState,
  run: { startedAt: number; modelId: string },
  status: AgentStatus,
  details: ResultDetails = {},
): AgentResult {
  return {
    status,
    summary: details.summary ?? null,
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

/** The summary from a finish_task call in these messages, if any. */
export function findFinishSummary(messages: ModelMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-call" && part.toolName === "finish_task") {
        const summary = (part.input as { summary?: unknown }).summary;
        return typeof summary === "string" ? summary : "";
      }
    }
  }
  return null;
}
