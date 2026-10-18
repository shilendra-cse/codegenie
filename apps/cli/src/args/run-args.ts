import path from "node:path";
import { parseArgs } from "node:util";
import type { AgentLimits } from "@codegenie/agent";
import type { DraftOverrides, RepoSource } from "@codegenie/runner";
import { CHECK_NAMES, type Check, type CheckName } from "@codegenie/shared";
import {
  parseSource,
  positiveNumber,
  UsageError,
  usageError,
} from "./common.js";

export type CliOptions = {
  help: false;
  source: RepoSource;
  task: { text: string } | { file: string };
  model?: string;
  limits: Partial<AgentLimits>;
  setupOverrides: DraftOverrides;
  environmentPath?: string;
  saveEnvironmentPath?: string;
  baselineChecks: boolean;
  patchPath?: string;
  keep: boolean;
  json: boolean;
};

export const RUN_USAGE = `Usage: pnpm agent:run --repo <path|git url> --task "<text>" [options]

  --repo <path|url>      local folder or public git URL (required)
  --ref <branch|tag>     branch or tag to clone (git URLs)
  --task <text>          the task, or --task-file <file>
  --model <id>           catalog model (default: AGENT_MODEL)
  --max-steps <n>        default 150
  --max-cost <usd>       default 2
  --timeout <minutes>    default 30
  --install <cmd>        install command instead of the detected one
  --no-install           skip installing dependencies
  --check <name=cmd>     override a check (lint, typecheck, test, build); repeatable
  --environment <file>   replay this environment config instead of detecting one
  --save-environment <file>  save the environment config this run used
  --no-baseline-checks   don't run the checks before the agent
  --patch <file>         save the diff to a file
  --keep                 keep the sandbox for inspection
  --json                 print the result as JSON
  --help`;

function parseCheck(spec: string): Check {
  const separator = spec.indexOf("=");
  const name = spec.slice(0, separator);
  const command = spec.slice(separator + 1).trim();
  if (separator < 1 || !command) {
    throw new UsageError(`--check expects name=command, got "${spec}"`);
  }
  if (!CHECK_NAMES.includes(name as CheckName)) {
    throw new UsageError(
      `--check name must be one of: ${CHECK_NAMES.join(", ")}`,
    );
  }
  return { name: name as CheckName, command, cwd: "." };
}

export function parseCliArgs(
  argv: string[],
  cwd: string,
): CliOptions | { help: true } {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv[0] === "--" ? argv.slice(1) : argv,
      options: {
        repo: { type: "string" },
        ref: { type: "string" },
        task: { type: "string" },
        "task-file": { type: "string" },
        model: { type: "string" },
        "max-steps": { type: "string" },
        "max-cost": { type: "string" },
        timeout: { type: "string" },
        install: { type: "string" },
        "no-install": { type: "boolean", default: false },
        check: { type: "string", multiple: true },
        patch: { type: "string" },
        environment: { type: "string" },
        "save-environment": { type: "string" },
        "no-baseline-checks": { type: "boolean", default: false },
        keep: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw usageError(error);
  }

  if (values.help) return { help: true };

  if (Boolean(values.task) === Boolean(values["task-file"])) {
    throw new UsageError("Pass exactly one of --task or --task-file");
  }
  if (values.install && values["no-install"]) {
    throw new UsageError("--install and --no-install can't be combined");
  }

  const source: RepoSource = parseSource(values.repo, values.ref, cwd);

  const timeoutMinutes = positiveNumber("--timeout", values.timeout);
  const limits: Partial<AgentLimits> = {};
  const maxSteps = positiveNumber("--max-steps", values["max-steps"]);
  const maxCost = positiveNumber("--max-cost", values["max-cost"]);
  if (maxSteps !== undefined) limits.maxSteps = Math.floor(maxSteps);
  if (maxCost !== undefined) limits.maxCostUsd = maxCost;
  if (timeoutMinutes !== undefined)
    limits.maxWallTimeMs = timeoutMinutes * 60_000;

  if (
    values.environment &&
    (values.install || values["no-install"] || values.check?.length)
  ) {
    throw new UsageError(
      "--install, --no-install and --check can't be combined with --environment; edit the config instead",
    );
  }

  const setupOverrides: DraftOverrides = {};
  if (values["no-install"]) setupOverrides.install = false;
  else if (values.install) setupOverrides.install = values.install;
  if (values.check?.length)
    setupOverrides.checks = values.check.map(parseCheck);

  return {
    help: false,
    source,
    task: values.task
      ? { text: values.task }
      : { file: path.resolve(cwd, values["task-file"]!) },
    model: values.model,
    limits,
    setupOverrides,
    environmentPath: values.environment
      ? path.resolve(cwd, values.environment)
      : undefined,
    saveEnvironmentPath: values["save-environment"]
      ? path.resolve(cwd, values["save-environment"])
      : undefined,
    baselineChecks: !values["no-baseline-checks"],
    patchPath: values.patch ? path.resolve(cwd, values.patch) : undefined,
    keep: values.keep,
    json: values.json,
  };
}
