import type { SetupResult } from "@codegenie/shared";
import type { ResolvedModel } from "../model/resolve-model.js";
import { buildRepoContext } from "./prompt/repo-context.js";
import { buildSystemPrompt } from "./prompt/system-prompt.js";
import type { ToolContext } from "../tools/core/context.js";
import { createTools } from "./tools/index.js";
import type { AgentResult } from "../loop/agent-result.js";
import type { Emit } from "../loop/events.js";
import type { AgentLimits } from "../loop/limits.js";
import { runLoop } from "../loop/run-loop.js";

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

function readSummary(finishInput: unknown): string | null {
  if (finishInput === undefined) return null;
  const summary = (finishInput as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
  const { ctx } = options;
  const { finishInput, ...result } = await runLoop({
    runId: options.runId,
    model: options.model,
    system: async () =>
      buildSystemPrompt(await buildRepoContext(ctx, options.setup)),
    firstMessage: options.task,
    tools: createTools(ctx),
    finish: {
      name: "finish_task",
      nudge:
        "You stopped without calling finish_task. Continue working on the task, or call finish_task if it is complete.",
      wrapUp:
        "Stop working now and call finish_task with a summary of what you completed, what is left undone, and the state of the checks.",
    },
    limits: options.limits,
    emit: options.emit,
    signal: options.signal,
  });
  return { ...result, summary: readSummary(finishInput) };
}
