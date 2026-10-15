import type { Sandbox } from "@codegenie/sandbox";
import type { Check, JobEvent, SetupResult } from "@codegenie/shared";
import type { EcosystemDetector, InstallPlan } from "./core/detector.js";
import { RepoReader } from "./core/repo-reader.js";
import { DETECTORS } from "./detectors/index.js";
import { runInstall } from "./install/run-install.js";

/** Caller-provided corrections that win over detection (e.g. CLI flags, later project settings). */
export type SetupOverrides = {
  /** A command to use instead of the detected install, or false to skip installing. */
  install?: string | false;
  /** Replace detected checks with the same name; others are added. */
  checks?: Check[];
};

export type RunSetupOptions = {
  /** Used as jobId on emitted events. */
  runId: string;
  emit?: (event: JobEvent) => void;
  overrides?: SetupOverrides;
  /** Defaults to all registered detectors. */
  detectors?: EcosystemDetector[];
};

function mergeChecks(detected: Check[], overrides: Check[] = []) {
  const overridden = new Set(overrides.map((c) => c.name));
  return [...detected.filter((c) => !overridden.has(c.name)), ...overrides];
}

/**
 * Prepares the repository in /workspace before the agent runs: detects the
 * ecosystem, installs dependencies and finds check commands. Deterministic, no AI.
 * Never fails the run: problems are reported in the result's notes and install status.
 */
export async function runSetup(
  sandbox: Sandbox,
  options: RunSetupOptions,
): Promise<SetupResult> {
  const emit = options.emit ?? (() => {});
  const ts = () => new Date().toISOString();
  emit({ type: "setup_started", jobId: options.runId, ts: ts() });

  const repo = new RepoReader(sandbox);
  let detection = null;
  for (const detector of options.detectors ?? DETECTORS) {
    detection = await detector.detect(repo);
    if (detection) break;
  }

  const notes = detection ? [...detection.notes] : [];
  if (!detection) {
    notes.push(
      "No supported project type was detected (currently JavaScript/TypeScript with a package.json). Explore the repository to find how to install and test it.",
    );
  }

  const overrides = options.overrides ?? {};
  const plan: InstallPlan | null =
    overrides.install === false
      ? null
      : overrides.install
        ? { frozen: overrides.install, fallback: null }
        : (detection?.install ?? null);
  const install = await runInstall(sandbox, plan);
  if (install.status === "failed") {
    notes.push(
      `Installing dependencies failed (${install.command}). Full output: ${install.logPath}.`,
    );
  }

  const checks = mergeChecks(detection?.checks ?? [], overrides.checks);
  const result: SetupResult = {
    ecosystem: detection?.ecosystem ?? null,
    packageManager: detection?.packageManager ?? null,
    install,
    checks,
    notes,
  };

  emit({
    type: "setup_completed",
    jobId: options.runId,
    ts: ts(),
    success: install.status !== "failed",
    commands: {
      ...(install.command ? { install: install.command } : {}),
      ...Object.fromEntries(checks.map((c) => [c.name, c.command])),
    },
  });
  return result;
}
