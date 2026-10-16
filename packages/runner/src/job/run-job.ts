import {
  createToolContext,
  runAgent,
  type AgentLimits,
  type Emit,
  type ResolvedModel,
} from "@codegenie/agent";
import { DockerSandbox, type Sandbox } from "@codegenie/sandbox";
import type { JobStage } from "@codegenie/shared";
import type { JobResult, JobStageName } from "./job-result.js";
import { collectDiff, createBaseline } from "../stages/changes/index.js";
import { checkoutRepo, type RepoSource } from "../stages/checkout/index.js";
import { runSetup, type SetupOverrides } from "../stages/setup/index.js";
import { runVerify } from "../stages/verify/index.js";

export type RunJobOptions = {
  runId: string;
  task: string;
  source: RepoSource;
  model: ResolvedModel;
  limits?: Partial<AgentLimits>;
  setupOverrides?: SetupOverrides;
  emit?: Emit;
  signal?: AbortSignal;
  keepSandbox?: boolean;
  createSandbox?: () => Promise<Sandbox>;
};

const EVENT_STAGE: Record<JobStageName, JobStage> = {
  sandbox: "prepare",
  checkout: "checkout",
  setup: "setup",
  agent: "agent",
  verify: "verify",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runJob(options: RunJobOptions): Promise<JobResult> {
  const { runId, signal } = options;
  const emit: Emit = options.emit ?? (() => {});
  const startedAt = Date.now();
  const result: Omit<JobResult, "status" | "durationMs"> = {};
  const finish = (status: JobResult["status"]): JobResult => ({
    status,
    ...result,
    durationMs: Date.now() - startedAt,
  });

  let stage = "sandbox" as JobStageName;
  const enter = (next: JobStageName) => {
    stage = next;
    emit({
      type: "stage_changed",
      jobId: runId,
      ts: new Date().toISOString(),
      stage: EVENT_STAGE[next],
    });
  };

  enter("sandbox");
  let sandbox: Sandbox;
  try {
    sandbox = await (options.createSandbox ?? (() => DockerSandbox.create()))();
  } catch (error) {
    return {
      ...finish("failed"),
      failedStage: "sandbox",
      error: errorMessage(error),
    };
  }
  result.sandboxId = sandbox.id;
  emit({
    type: "sandbox_created",
    jobId: runId,
    ts: new Date().toISOString(),
    sandboxId: sandbox.id,
  });

  try {
    if (signal?.aborted) return finish("cancelled");

    enter("checkout");
    result.checkout = await checkoutRepo(sandbox, options.source);
    if (signal?.aborted) return finish("cancelled");

    enter("setup");
    const setup = await runSetup(sandbox, {
      runId,
      emit,
      overrides: options.setupOverrides,
    });
    result.setup = setup;
    const baseline = await createBaseline(sandbox);
    if (signal?.aborted) return finish("cancelled");

    enter("agent");
    const agent = await runAgent({
      runId,
      task: options.task,
      ctx: createToolContext(sandbox, setup.checks),
      model: options.model,
      limits: options.limits,
      setup,
      emit,
      signal,
    });
    result.agent = agent;
    if (agent.status === "cancelled") return finish("cancelled");

    enter("verify");
    result.verify = await runVerify(sandbox, setup.checks);
    result.checksPassed = result.verify.length
      ? result.verify.every((check) => check.passed)
      : null;
    result.diff = await collectDiff(sandbox, baseline);

    return finish(agent.status);
  } catch (error) {
    // An agent failure (e.g. the sandbox disappeared) already has its own status.
    if (stage === "verify" && result.agent?.status === "failed") {
      return finish("failed");
    }
    return {
      ...finish("failed"),
      failedStage: stage,
      error: errorMessage(error),
    };
  } finally {
    if (!options.keepSandbox) await sandbox.destroy().catch(() => {});
  }
}
