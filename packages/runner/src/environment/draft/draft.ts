import type { Sandbox } from "@codegenie/sandbox";
import { checkKey, type Check, type SetupStep } from "@codegenie/shared";
import type { EcosystemDetector } from "./detector.js";
import { RepoReader } from "./repo-reader.js";
import { DETECTORS } from "./detectors.js";

export type DraftStep = SetupStep & {
  /** Tried in order when `command` fails; the config keeps whichever worked. */
  alternatives?: string[];
};

export type Draft = {
  steps: DraftStep[];
  checks: Check[];
  notes: string[];
  overridden: boolean;
};

export type DraftOverrides = {
  install?: string | false;
  checks?: Check[];
};

const ECOSYSTEM_LABEL = { node: "JavaScript/TypeScript" } as const;

function mergeChecks(detected: Check[], overrides: Check[] = []) {
  const overridden = new Set(overrides.map(checkKey));
  return [
    ...detected.filter((check) => !overridden.has(checkKey(check))),
    ...overrides,
  ];
}

export async function draftEnvironment(
  sandbox: Sandbox,
  options: { overrides?: DraftOverrides; detectors?: EcosystemDetector[] } = {},
): Promise<Draft> {
  const repo = new RepoReader(sandbox);
  let detection = null;
  for (const detector of options.detectors ?? DETECTORS) {
    detection = await detector.detect(repo);
    if (detection) break;
  }

  const notes: string[] = [];
  if (detection) {
    notes.push(
      `${ECOSYSTEM_LABEL[detection.ecosystem]} project${detection.packageManager ? ` using ${detection.packageManager}` : ""}.`,
      ...detection.notes,
    );
  } else {
    notes.push(
      "No supported project type was detected (currently JavaScript/TypeScript with a package.json). Explore the repository to find how to install and test it.",
    );
  }

  const overrides = options.overrides ?? {};
  let steps: DraftStep[] = [];
  if (overrides.install) {
    steps = [{ name: "install", cwd: ".", command: overrides.install }];
  } else if (overrides.install !== false && detection?.install) {
    const { frozen, fallback } = detection.install;
    steps = [
      {
        name: "install",
        cwd: ".",
        command: frozen,
        ...(fallback ? { alternatives: [fallback] } : {}),
      },
    ];
  }

  return {
    steps,
    checks: mergeChecks(detection?.checks ?? [], overrides.checks),
    notes,
    overridden: overrides.install !== undefined || Boolean(overrides.checks),
  };
}
