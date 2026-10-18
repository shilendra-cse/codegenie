import type { ToolSet } from "ai";
import { UsageTracker } from "../model/usage.js";
import type { ResolvedModel } from "../model/resolve-model.js";
import {
  buildResult,
  type AgentStatus,
  type LoopResult,
  type ResultDetails,
} from "./agent-result.js";
import { Compactor } from "./compaction.js";
import { errorMessage, isInfrastructureError } from "./errors.js";
import type { Emit } from "./events.js";
import {
  DEFAULT_LIMITS,
  describeLimit,
  type AgentLimits,
  type LimitReached,
} from "./limits.js";
import {
  runSegment,
  type RunEnvironment,
  type RunState,
} from "./run-segment.js";

const MAX_NUDGES = 2;
const WRAP_UP_TIMEOUT_MS = 2 * 60_000;
const TOOL_SCHEMA_CHARS = 4_000;

export type FinishTool = {
  name: string;
  /** Sent when the model stops without calling the finish tool. */
  nudge: string;
  /** Sent after the limit description when a limit is reached. */
  wrapUp: string;
};

export type RunLoopOptions = {
  runId: string;
  model: ResolvedModel;
  /** Built before the first model call; a sandbox error here fails the run. */
  system: () => Promise<string>;
  firstMessage: string;
  tools: ToolSet;
  finish: FinishTool;
  limits?: Partial<AgentLimits>;
  emit?: Emit;
  signal?: AbortSignal;
};

export async function runLoop(options: RunLoopOptions): Promise<LoopResult> {
  const { runId, model, tools, finish } = options;
  const limits: AgentLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const run = { startedAt: Date.now(), modelId: model.spec.id };
  const newState = (fixedChars: number): RunState => ({
    messages: [{ role: "user", content: options.firstMessage }],
    steps: 0,
    usage: new UsageTracker(model.spec.pricing),
    compactor: new Compactor({
      contextWindow: model.spec.contextWindow,
      fixedChars,
    }),
  });

  let system: string;
  try {
    system = await options.system();
  } catch (error) {
    if (!isInfrastructureError(error)) throw error;
    return buildResult(newState(0), run, "failed", {
      error: `Sandbox error: ${errorMessage(error)}`,
    });
  }
  const toolDescriptionChars = JSON.stringify(
    Object.values(tools).map((t) => t.description),
  ).length;
  const state = newState(
    system.length + toolDescriptionChars + TOOL_SCHEMA_CHARS,
  );
  const result = (status: AgentStatus, details?: ResultDetails) =>
    buildResult(state, run, status, details);

  const env: RunEnvironment = {
    runId,
    model,
    system,
    tools,
    finishTool: finish.name,
    emit: options.emit ?? (() => {}),
    maxCostUsd: limits.maxCostUsd,
    infraAbort: new AbortController(),
  };
  const userSignal = options.signal;
  const withUser = (...signals: AbortSignal[]) =>
    AbortSignal.any(userSignal ? [...signals, userSignal] : signals);
  const deadline = AbortSignal.timeout(limits.maxWallTimeMs);
  const mainSignal = withUser(env.infraAbort.signal, deadline);

  let nudges = 0;
  while (true) {
    const outcome = await runSegment(state, env, {
      maxSteps: limits.maxSteps - state.steps,
      signal: mainSignal,
      costLimit: true,
    });

    if (outcome.finishInput !== undefined) {
      return result("succeeded", { finishInput: outcome.finishInput });
    }
    if (outcome.infraError) {
      return result("failed", {
        error: `Sandbox error: ${errorMessage(outcome.infraError)}`,
      });
    }
    if (userSignal?.aborted) return result("cancelled");
    if (outcome.modelError) {
      return result("failed", {
        error: `Model request failed: ${errorMessage(outcome.modelError)}`,
      });
    }

    const limit: LimitReached | null = deadline.aborted
      ? "time"
      : state.steps >= limits.maxSteps
        ? "steps"
        : state.usage.costUsd >= limits.maxCostUsd
          ? "cost"
          : null;
    if (limit) {
      return wrapUp(limit);
    }

    if (nudges >= MAX_NUDGES) {
      return result("failed", {
        error: `The agent stopped without calling ${finish.name}.`,
      });
    }
    nudges += 1;
    state.messages.push({ role: "user", content: finish.nudge });
  }

  async function wrapUp(limit: LimitReached): Promise<LoopResult> {
    state.messages.push({
      role: "user",
      content: `${describeLimit(limit, limits)} ${finish.wrapUp}`,
    });
    const outcome = await runSegment(state, env, {
      maxSteps: 1,
      signal: withUser(
        env.infraAbort.signal,
        AbortSignal.timeout(WRAP_UP_TIMEOUT_MS),
      ),
      toolChoice: { type: "tool", toolName: finish.name },
      costLimit: false,
    });
    if (userSignal?.aborted) return result("cancelled");
    return result("incomplete", {
      limitReached: limit,
      finishInput: outcome.finishInput,
      error:
        outcome.finishInput === undefined
          ? `Stopped at the ${limit} limit before ${finish.name} was called.`
          : undefined,
    });
  }
}
