import type { Emit } from "@codegenie/agent";
import type { Sandbox } from "@codegenie/sandbox";
import {
  checkKey,
  type Check,
  type EnvironmentConfig,
  type SetupResult,
} from "@codegenie/shared";
import { applySteps } from "../../environment/apply.js";
import { buildConfig } from "../../environment/build-config.js";
import { isUsable, runChecks } from "../../environment/checks.js";
import {
  draftEnvironment,
  type DraftOverrides,
  type DraftStep,
} from "../../environment/draft/draft.js";
import { changedPaths, createBaseline } from "../changes/index.js";

export type RunSetupOptions = {
  runId: string;
  emit: Emit;
  environment?: EnvironmentConfig;
  overrides?: DraftOverrides;
  baselineChecks: boolean;
};

export type PreparedEnvironment = {
  setup: SetupResult;
  /** Commit to diff against for the agent's changes. */
  gitBase: string;
  /** Files written by running the checks; never part of the agent's changes. */
  checkArtifacts: string[];
};

async function headCommit(sandbox: Sandbox) {
  const head = await sandbox.exec("git rev-parse HEAD");
  return head.exitCode === 0 ? head.stdout.trim() : undefined;
}

export async function runSetup(
  sandbox: Sandbox,
  options: RunSetupOptions,
): Promise<PreparedEnvironment> {
  const { runId, emit, environment } = options;
  if (environment && options.overrides) {
    throw new Error(
      "Setup overrides can't be combined with a given environment config; edit the config instead.",
    );
  }
  emit({ type: "setup_started", jobId: runId, ts: new Date().toISOString() });

  const commit = await headCommit(sandbox);
  const draft = environment
    ? null
    : await draftEnvironment(sandbox, { overrides: options.overrides });
  const stepsToRun: DraftStep[] = environment?.steps ?? draft!.steps;
  const checks: Check[] = environment?.checks ?? draft!.checks;
  const notes = [...(draft?.notes ?? [])];

  const steps = await applySteps(sandbox, stepsToRun);
  for (const step of steps.filter((s) => s.status === "failed")) {
    notes.push(
      `Setup step "${step.name}" (${step.cwd}) failed: \`${step.command}\`. Full output: ${step.logPath}.`,
    );
  }

  // Taken before the checks run, so files they write can be told apart from the agent's changes.
  const gitBase = await createBaseline(sandbox);
  const baseline = options.baselineChecks
    ? await runChecks(sandbox, checks, "baseline")
    : null;
  const checkArtifacts = baseline?.length
    ? await changedPaths(sandbox, gitBase)
    : [];

  const statuses = new Map((baseline ?? []).map((c) => [checkKey(c), c]));
  const usable = checks.filter((check) => {
    const result = statuses.get(checkKey(check));
    if (!result || isUsable(result.status)) return true;
    notes.push(
      `Check "${check.name}" (${check.cwd}) removed: ${result.status === "broken" ? "the command could not run" : "it timed out"} (\`${check.command}\`).`,
    );
    return false;
  });

  const setup: SetupResult = {
    config:
      environment ?? buildConfig({ draft: draft!, steps, baseline, commit }),
    steps,
    baseline,
    checks: usable,
    health: steps.some((s) => s.status === "failed") ? "needs_attention" : "ok",
    notes,
  };

  emit({
    type: "setup_completed",
    jobId: runId,
    ts: new Date().toISOString(),
    success: setup.health === "ok",
    steps: steps.map(({ name, status }) => ({ name, status })),
    checks: checks.map((check) => ({
      name: check.name,
      cwd: check.cwd,
      ...(statuses.get(checkKey(check))
        ? { status: statuses.get(checkKey(check))!.status }
        : {}),
    })),
  });

  return { setup, gitBase, checkArtifacts };
}
