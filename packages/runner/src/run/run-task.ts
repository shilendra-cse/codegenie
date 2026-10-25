import {
  createToolContext,
  runAgent,
  type AgentLimits,
  type Emit,
  type ResolvedModel,
} from "@hobai/agent";
import { DockerSandbox, type Sandbox } from "@hobai/sandbox";
import type { EnvironmentConfig, RunStage } from "@hobai/shared";
import { collectDiff } from "../stages/changes/index.js";
import { checkoutRepo, type RepoSource } from "../stages/checkout/index.js";
import { listChanges, snapshotChanges } from "../stages/deliver/index.js";
import { runSetup } from "../stages/setup/index.js";
import { runVerify } from "../stages/verify/index.js";
import type { Deliver, RunResult, RunStageName } from "./run-result.js";

export type RunTaskOptions = {
  runId: string;
  task: string;
  source: RepoSource;
  model: ResolvedModel;
  limits?: Partial<AgentLimits>;
  environment?: EnvironmentConfig;
  /** Run every check before the agent (default true). */
  baselineChecks?: boolean;
  emit?: Emit;
  signal?: AbortSignal;
  keepSandbox?: boolean;
  createSandbox?: () => Promise<Sandbox>;
  /** Runs right after checkout, before setup (e.g. evals pin a commit or plant a bug). */
  afterCheckout?: (sandbox: Sandbox) => Promise<void>;
  /** Called for a succeeded or incomplete run with changes, while the sandbox is still there. */
  deliver?: Deliver;
};

const EVENT_STAGE: Record<RunStageName, RunStage> = {
  sandbox: "prepare",
  checkout: "checkout",
  setup: "setup",
  agent: "agent",
  verify: "verify",
  deliver: "deliver",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runTask(options: RunTaskOptions): Promise<RunResult> {
  const { runId, signal } = options;
  const emit: Emit = options.emit ?? (() => {});
  const startedAt = Date.now();
  const result: Omit<RunResult, "status" | "durationMs"> = {};
  const finish = (status: RunResult["status"]): RunResult => ({
    status,
    ...result,
    durationMs: Date.now() - startedAt,
  });

  let stage = "sandbox" as RunStageName;
  const enter = (next: RunStageName) => {
    stage = next;
    emit({
      type: "stage_changed",
      runId,
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
    runId,
    ts: new Date().toISOString(),
    sandboxId: sandbox.id,
  });

  try {
    if (signal?.aborted) return finish("cancelled");

    enter("checkout");
    result.checkout = await checkoutRepo(sandbox, options.source);
    await options.afterCheckout?.(sandbox);
    if (signal?.aborted) return finish("cancelled");

    enter("setup");
    const { setup, gitBase } = await runSetup(sandbox, {
      runId,
      emit,
      environment: options.environment,
      baselineChecks: options.baselineChecks ?? true,
    });
    result.setup = setup;
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
    // Before the checks run again, so files they write stay out of the diff.
    result.diff = await collectDiff(sandbox, gitBase);
    const snapshot = options.deliver ? await snapshotChanges(sandbox) : null;
    result.verify = await runVerify(sandbox, setup.checks, setup.baseline);
    emit({
      type: "checks_completed",
      runId,
      ts: new Date().toISOString(),
      passed: result.verify.passed,
      checks: result.verify.checks.map(
        ({ name, cwd, command, status, comparison }) => ({
          name,
          cwd,
          command,
          status,
          comparison,
        }),
      ),
    });

    const deliverable =
      agent.status === "succeeded" || agent.status === "incomplete";
    if (
      options.deliver &&
      snapshot &&
      deliverable &&
      result.diff.files.length > 0
    ) {
      if (signal?.aborted) return finish("cancelled");
      enter("deliver");
      const changes = await listChanges(sandbox, gitBase, snapshot);
      result.delivery = await options.deliver(changes, {
        agent,
        verify: result.verify,
        diff: result.diff,
      });
    }

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
