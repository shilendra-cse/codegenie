import type { SetupResult } from "@codegenie/shared";
import { UsageTracker } from "../model/usage.js";
import type { ResolvedModel } from "../model/resolve-model.js";
import { buildRepoContext } from "../prompt/repo-context.js";
import { buildSystemPrompt } from "../prompt/system-prompt.js";
import type { ToolContext } from "../tools/core/context.js";
import { createTools } from "../tools/index.js";
import {
  buildResult,
  type AgentResult,
  type AgentStatus,
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

const NUDGE =
  "You stopped without calling finish_task. Continue working on the task, or call finish_task if it is complete.";

export type RunAgentOptions = {
  runId: string;
  task: string;
  ctx: ToolContext;
  model: ResolvedModel;
  limits?: Partial<AgentLimits>;
  setup?: SetupResult;
  emit?: Emit;
  signal?: AbortSignal;
};

export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
  const { runId, task, ctx, model } = options;
  const limits: AgentLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const run = { startedAt: Date.now(), modelId: model.spec.id };
  const tools = createTools(ctx);
  const newState = (fixedChars: number): RunState => ({
    messages: [{ role: "user", content: task }],
    steps: 0,
    usage: new UsageTracker(model.spec.pricing),
    compactor: new Compactor({
      contextWindow: model.spec.contextWindow,
      fixedChars,
    }),
  });

  let system: string;
  try {
    system = buildSystemPrompt(await buildRepoContext(ctx, options.setup));
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

    if (outcome.finishSummary !== null) {
      return result("succeeded", { summary: outcome.finishSummary });
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
        error: "The agent stopped without calling finish_task.",
      });
    }
    nudges += 1;
    state.messages.push({ role: "user", content: NUDGE });
  }

  async function wrapUp(limit: LimitReached): Promise<AgentResult> {
    state.messages.push({
      role: "user",
      content: `${describeLimit(limit, limits)} Stop working now and call finish_task with a summary of what you completed, what is left undone, and the state of the checks.`,
    });
    const outcome = await runSegment(state, env, {
      maxSteps: 1,
      signal: withUser(
        env.infraAbort.signal,
        AbortSignal.timeout(WRAP_UP_TIMEOUT_MS),
      ),
      toolChoice: { type: "tool", toolName: "finish_task" },
      costLimit: false,
    });
    if (userSignal?.aborted) return result("cancelled");
    return result("incomplete", {
      limitReached: limit,
      summary: outcome.finishSummary,
      error:
        outcome.finishSummary === null
          ? `Stopped at the ${limit} limit before a summary was written.`
          : undefined,
    });
  }
}
