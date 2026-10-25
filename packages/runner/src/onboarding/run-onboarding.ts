import {
  runSetupAgent,
  type AgentLimits,
  type Emit,
  type ResolvedModel,
  type SetupAgentResult,
} from "@hobai/agent";
import { DockerSandbox, type Sandbox } from "@hobai/sandbox";
import {
  checkKey,
  type EnvironmentConfig,
  type EnvironmentDecision,
  type EnvironmentProposal,
  type OnboardingStatus,
  type TryResult,
  type UserChannel,
} from "@hobai/shared";
import { buildConfig } from "../environment/build-config.js";
import { isUsable } from "../environment/checks.js";
import { draftEnvironment } from "../environment/draft/draft.js";
import {
  checkoutRepo,
  headCommit,
  type RepoSource,
} from "../stages/checkout/index.js";
import { findProblems } from "./problems.js";
import { formatEnvironment } from "./summary.js";
import { createTryEnvironment } from "./try-environment.js";

export type RunOnboardingOptions = {
  runId: string;
  source: RepoSource;
  /** Used only when the drafted setup has problems. */
  model: ResolvedModel;
  channel: UserChannel;
  /** Saves a working setup without asking "Save this environment?" (the website saves straight away). */
  autoApprove?: boolean;
  agentLimits?: Partial<AgentLimits>;
  emit?: Emit;
  signal?: AbortSignal;
  createSandbox?: () => Promise<Sandbox>;
  /** Runs right after each checkout (e.g. evals pin a commit). */
  afterCheckout?: (sandbox: Sandbox) => Promise<void>;
};

export type OnboardingResult = {
  status: OnboardingStatus;
  error?: string;
  /** Set once the final check ran, also when the user discarded it. */
  config?: EnvironmentConfig;
  /** Results of the final check in a fresh sandbox. */
  final?: TryResult;
  /** null when the drafted setup had no problems. */
  agent: Omit<SetupAgentResult, "messages" | "proposal"> | null;
  notes: string[];
  durationMs: number;
};

const sameProposal = (a: EnvironmentProposal, b: EnvironmentProposal) =>
  JSON.stringify(a) === JSON.stringify(b);

const asProposal = (
  setup: TryResult,
  checks: EnvironmentProposal["checks"],
) => ({
  steps: setup.steps.map(({ name, cwd, command }) => ({ name, cwd, command })),
  checks,
});

function compareWithLastTry(last: TryResult, final: TryResult) {
  const before = new Map(last.checks.map((c) => [checkKey(c), c.status]));
  return final.checks.flatMap((check) => {
    const earlier = before.get(checkKey(check));
    return earlier && earlier !== check.status
      ? [
          `Check "${check.name}" (${check.cwd}) was ${earlier} during setup but ${check.status} in the final check.`,
        ]
      : [];
  });
}

export async function runOnboarding(
  options: RunOnboardingOptions,
): Promise<OnboardingResult> {
  const { runId, source, channel, signal } = options;
  const startedAt = Date.now();
  const createSandbox = options.createSandbox ?? (() => DockerSandbox.create());
  const sandboxes: Sandbox[] = [];
  const newSandbox = async () => {
    const sandbox = await createSandbox();
    sandboxes.push(sandbox);
    await checkoutRepo(sandbox, source);
    await options.afterCheckout?.(sandbox);
    return sandbox;
  };

  const now = () => new Date().toISOString();
  // What each try installed and checked, so a viewer can show it, not only the summary text.
  const report = (phase: "first" | "agent" | "final", tried: TryResult) =>
    options.emit?.({
      type: "setup_completed",
      runId,
      ts: now(),
      phase,
      success: tried.steps.every((step) => step.status === "ok"),
      steps: tried.steps.map(({ name, cwd, command, status }) => ({
        name,
        cwd,
        command,
        status,
      })),
      checks: tried.checks.map(({ name, cwd, command, status }) => ({
        name,
        cwd,
        command,
        status,
      })),
    });

  const notes: string[] = [];
  let agent: OnboardingResult["agent"] = null;
  const result = (
    status: OnboardingStatus,
    extra: Partial<OnboardingResult> = {},
  ): OnboardingResult => ({
    status,
    agent,
    notes,
    durationMs: Date.now() - startedAt,
    ...extra,
  });

  try {
    channel.info("Preparing a sandbox…");
    const sandbox = await newSandbox();
    const commit = await headCommit(sandbox);
    const draft = await draftEnvironment(sandbox);
    notes.push(...draft.notes);
    options.emit?.({
      type: "setup_drafted",
      runId,
      ts: now(),
      projects: draft.projects,
    });
    if (signal?.aborted) return result("cancelled");

    channel.info("Installing dependencies and running checks…");
    const tryEnvironment = createTryEnvironment(sandbox);
    const first = await tryEnvironment(draft);
    report("first", first);
    let proposal = asProposal(first, draft.checks);
    let lastTry = { proposal, result: first };
    let decisions: EnvironmentDecision[] = [];
    if (signal?.aborted) return result("cancelled");

    const problems = findProblems(first);
    if (problems.length > 0) {
      channel.info(
        `Found ${problems.length === 1 ? "a problem" : `${problems.length} problems`}; starting the setup agent:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
      );
      const {
        messages,
        proposal: agentProposal,
        ...outcome
      } = await runSetupAgent({
        runId,
        sandbox,
        model: options.model,
        initial: { proposal, result: first, notes: draft.notes },
        tryEnvironment: async (tried) => {
          const tryResult = await tryEnvironment(tried);
          report("agent", tryResult);
          lastTry = { proposal: tried, result: tryResult };
          return tryResult;
        },
        channel,
        limits: options.agentLimits,
        emit: options.emit,
        signal,
      });
      void messages;
      agent = outcome;
      decisions = outcome.decisions;
      if (outcome.status === "cancelled") return result("cancelled");
      if (agentProposal) {
        proposal = agentProposal;
        notes.push(...outcome.notes);
      } else {
        notes.push(
          `The setup agent didn't finish (${outcome.error ?? outcome.status}); the drafted setup is used.`,
        );
      }
    } else {
      channel.info(
        "Everything installed and every check passed; no changes needed.",
      );
    }

    channel.info("Final check in a fresh sandbox…");
    const fresh = await newSandbox();
    const final = await createTryEnvironment(fresh, "final")(proposal);
    report("final", final);
    if (sameProposal(lastTry.proposal, proposal)) {
      notes.push(...compareWithLastTry(lastTry.result, final));
    }
    for (const step of final.steps.filter((s) => s.status === "failed")) {
      notes.push(
        `Setup step "${step.name}" (${step.cwd}) failed in the final check: \`${step.command}\`.`,
      );
    }
    for (const check of final.checks.filter((c) => !isUsable(c.status))) {
      notes.push(
        `Check "${check.name}" (${check.cwd}) left out: ${check.status === "broken" ? "the command could not run" : "it timed out"} in the final check.`,
      );
    }

    const config = buildConfig({
      steps: final.steps,
      checks: proposal.checks,
      results: final.checks,
      source: agent ? "ai" : "detected",
      commit,
      decisions,
    });
    channel.info(formatEnvironment({ config, final, notes, decisions }));
    if (signal?.aborted) return result("cancelled", { config, final });

    if (options.autoApprove) return result("approved", { config, final });
    const answer = await channel.ask({
      question: "Save this environment?",
      options: [{ label: "Save" }, { label: "Discard" }],
      allowOther: false,
    });
    const approved = "option" in answer && answer.option === 0;
    return result(approved ? "approved" : "discarded", { config, final });
  } catch (error) {
    if (signal?.aborted) return result("cancelled");
    return result("failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await Promise.all(sandboxes.map((s) => s.destroy().catch(() => {})));
  }
}
