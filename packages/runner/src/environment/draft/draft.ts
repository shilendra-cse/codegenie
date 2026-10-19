import type { Sandbox } from "@codegenie/sandbox";
import type { Check, SetupStep } from "@codegenie/shared";
import type { Detection, EcosystemDetector } from "./detector.js";
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
};

const ECOSYSTEM_LABEL = { node: "JavaScript/TypeScript" } as const;

function summary(detection: Detection) {
  const label = ECOSYSTEM_LABEL[detection.ecosystem];
  const [first, ...rest] = detection.projects;
  if (!first) return [];
  if (rest.length === 0 && first.cwd === ".") {
    return [
      `${label} project${first.packageManager ? ` using ${first.packageManager}` : ""}.`,
    ];
  }
  const list = detection.projects
    .map(
      (p) =>
        `${p.cwd === "." ? "root" : p.cwd}${p.packageManager ? ` (${p.packageManager})` : ""}`,
    )
    .join(", ");
  return [`${label} projects: ${list}.`];
}

export async function draftEnvironment(
  sandbox: Sandbox,
  options: { detectors?: EcosystemDetector[] } = {},
): Promise<Draft> {
  const repo = new RepoReader(sandbox);
  let detection = null;
  for (const detector of options.detectors ?? DETECTORS) {
    detection = await detector.detect(repo);
    if (detection) break;
  }

  const notes: string[] = [];
  if (detection) {
    notes.push(...summary(detection), ...detection.notes);
  } else {
    notes.push(
      "No supported project type was detected (currently JavaScript/TypeScript with a package.json). Explore the repository to find how to install and test it.",
    );
  }

  const steps: DraftStep[] = (detection?.projects ?? []).flatMap(
    ({ cwd, install }) =>
      install
        ? [
            {
              name: "install",
              cwd,
              command: install.frozen,
              ...(install.fallback ? { alternatives: [install.fallback] } : {}),
            },
          ]
        : [],
  );

  return {
    steps,
    checks: detection?.projects.flatMap((p) => p.checks) ?? [],
    notes,
  };
}
