import type { Emit } from "@codegenie/agent";
import type { Sandbox } from "@codegenie/sandbox";
import {
  checkKey,
  type Check,
  type EnvironmentConfig,
  type SetupResult,
} from "@codegenie/shared";
import { applySteps } from "../../environment/apply.js";
import { uncoveredProjects } from "../../environment/health.js";
import { buildConfig } from "../../environment/build-config.js";
import { isUsable, runChecks } from "../../environment/checks.js";
import {
  draftEnvironment,
  type DraftStep,
} from "../../environment/draft/draft.js";
import { createBaseline } from "../changes/index.js";
import { headCommit } from "../checkout/index.js";

export type RunSetupOptions = {
  runId: string;
  emit: Emit;
  environment?: EnvironmentConfig;
  baselineChecks: boolean;
};

export type PreparedEnvironment = {
  setup: SetupResult;
  /** Commit to diff against for the agent's changes. */
  gitBase: string;
};

export async function runSetup(
  sandbox: Sandbox,
  options: RunSetupOptions,
): Promise<PreparedEnvironment> {
  const { runId, emit, environment } = options;
  emit({ type: "setup_started", runId, ts: new Date().toISOString() });

  const commit = await headCommit(sandbox);
  const draft = environment ? null : await draftEnvironment(sandbox);
  const stepsToRun: DraftStep[] = environment?.steps ?? draft!.steps;
  const checks: Check[] = environment?.checks ?? draft!.checks;
  const notes = [...(draft?.notes ?? [])];

  const steps = await applySteps(sandbox, stepsToRun);
  for (const step of steps.filter((s) => s.status === "failed")) {
    notes.push(
      `Setup step "${step.name}" (${step.cwd}) failed: \`${step.command}\`. Full output: ${step.logPath}.`,
    );
  }

  const baseline = options.baselineChecks
    ? await runChecks(sandbox, checks, "baseline")
    : null;
  // After the checks, so files they write are part of the baseline, not the agent's changes.
  const gitBase = await createBaseline(sandbox);

  const statuses = new Map((baseline ?? []).map((c) => [checkKey(c), c]));
  const usable = checks.filter((check) => {
    const result = statuses.get(checkKey(check));
    if (!result || isUsable(result.status)) return true;
    notes.push(
      `Check "${check.name}" (${check.cwd}) removed: ${result.status === "broken" ? "the command could not run" : "it timed out"} (\`${check.command}\`).`,
    );
    return false;
  });

  const healthReasons = steps
    .filter((s) => s.status === "failed")
    .map((s) => `Setup step "${s.name}" (${s.cwd}) failed: \`${s.command}\`.`);
  if (environment) {
    for (const dir of await uncoveredProjects(sandbox, environment)) {
      healthReasons.push(
        `${dir === "." ? "The repository root" : `${dir}/`} has its own package.json but isn't covered by the environment.`,
      );
    }
  }

  const setup: SetupResult = {
    config:
      environment ??
      buildConfig({
        steps,
        checks,
        results: baseline,
        source: "detected",
        commit,
      }),
    steps,
    baseline,
    checks: usable,
    health: healthReasons.length ? "needs_attention" : "ok",
    healthReasons,
    notes,
  };

  emit({
    type: "setup_completed",
    runId,
    ts: new Date().toISOString(),
    success: setup.health === "ok",
    steps: steps.map(({ name, cwd, status }) => ({ name, cwd, status })),
    checks: checks.map((check) => ({
      name: check.name,
      cwd: check.cwd,
      ...(statuses.get(checkKey(check))
        ? { status: statuses.get(checkKey(check))!.status }
        : {}),
    })),
  });

  return { setup, gitBase };
}
