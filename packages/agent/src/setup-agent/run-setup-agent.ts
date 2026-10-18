import type { Sandbox } from "@codegenie/sandbox";
import type {
  EnvironmentDecision,
  EnvironmentProposal,
  TryResult,
  UserChannel,
} from "@codegenie/shared";
import type { LoopResult } from "../loop/agent-result.js";
import type { Emit } from "../loop/events.js";
import type { AgentLimits } from "../loop/limits.js";
import { runLoop } from "../loop/run-loop.js";
import type { ResolvedModel } from "../model/resolve-model.js";
import { describeRepository } from "../prompt/repository.js";
import { bashTool } from "../tools/bash/bash.js";
import { createToolContext } from "../tools/core/context.js";
import { listFilesTool } from "../tools/list-files/list-files.js";
import { readFileTool } from "../tools/read-file/read-file.js";
import { searchTool } from "../tools/search/search.js";
import type { SetupToolContext } from "./context.js";
import { buildSetupBrief, buildSetupSystemPrompt } from "./prompt.js";
import { askUserTool } from "./tools/ask-user/ask-user.js";
import {
  finishSetupInput,
  finishSetupTool,
} from "./tools/finish-setup/finish-setup.js";
import { tryEnvironmentTool } from "./tools/try-environment/try-environment.js";

export const SETUP_AGENT_LIMITS: AgentLimits = {
  maxSteps: 40,
  maxWallTimeMs: 20 * 60_000,
  maxCostUsd: 0.2,
};

export type RunSetupAgentOptions = {
  runId: string;
  sandbox: Sandbox;
  model: ResolvedModel;
  /** The setup the rules drafted, as tried, and what they noticed. */
  initial: {
    proposal: EnvironmentProposal;
    result: TryResult;
    notes: string[];
  };
  /** Runs a setup in the sandbox; provided by the runner. */
  tryEnvironment: (proposal: EnvironmentProposal) => Promise<TryResult>;
  channel: UserChannel;
  limits?: Partial<AgentLimits>;
  emit?: Emit;
  signal?: AbortSignal;
};

export type SetupAgentResult = Omit<LoopResult, "finishInput"> & {
  /** null when the agent didn't finish with a valid setup. */
  proposal: EnvironmentProposal | null;
  notes: string[];
  decisions: EnvironmentDecision[];
};

export async function runSetupAgent(
  options: RunSetupAgentOptions,
): Promise<SetupAgentResult> {
  const ctx = createToolContext(options.sandbox);
  const setupCtx: SetupToolContext = {
    tryEnvironment: options.tryEnvironment,
    channel: options.channel,
    questionsAsked: 0,
    decisions: [],
  };

  const { finishInput, ...result } = await runLoop({
    runId: options.runId,
    model: options.model,
    system: async () => buildSetupSystemPrompt(await describeRepository(ctx)),
    firstMessage: buildSetupBrief(options.initial),
    tools: {
      list_files: listFilesTool(ctx),
      read_file: readFileTool(ctx),
      search: searchTool(ctx),
      bash: bashTool(ctx),
      try_environment: tryEnvironmentTool(setupCtx),
      ask_user: askUserTool(setupCtx),
      finish_setup: finishSetupTool(),
    },
    finish: {
      name: "finish_setup",
      nudge:
        "You stopped without calling finish_setup. Continue, or call finish_setup with the setup you last tried.",
      wrapUp:
        "Stop now and call finish_setup with the setup you last tried, with notes on what is still unresolved.",
    },
    limits: { ...SETUP_AGENT_LIMITS, ...options.limits },
    emit: options.emit,
    signal: options.signal,
  });

  const parsed =
    finishInput === undefined ? null : finishSetupInput.safeParse(finishInput);
  if (parsed && !parsed.success) {
    return {
      ...result,
      status: "failed",
      error: "finish_setup was called with an invalid setup.",
      proposal: null,
      notes: [],
      decisions: setupCtx.decisions,
    };
  }
  return {
    ...result,
    proposal: parsed
      ? { steps: parsed.data.steps, checks: parsed.data.checks }
      : null,
    notes: parsed?.data.notes ?? [],
    decisions: setupCtx.decisions,
  };
}
