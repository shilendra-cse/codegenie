import path from "node:path";
import { parseArgs } from "node:util";
import type { AgentLimits } from "@codegenie/agent";
import type { RepoSource } from "@codegenie/runner";
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
  /** Replays this file instead of the repository's saved environment. */
  environmentPath?: string;
  baselineChecks: boolean;
  patchPath?: string;
  keep: boolean;
  json: boolean;
};

export const RUN_USAGE = `Usage: pnpm agent:run --repo <path|git url> --task "<text>" [options]

The repository must be set up first: pnpm agent:setup --repo <path|git url>

  --repo <path|url>      local folder or public git URL (required)
  --ref <branch|tag>     branch or tag to clone (git URLs)
  --task <text>          the task, or --task-file <file>
  --model <id>           catalog model (default: AGENT_MODEL)
  --max-steps <n>        default 150
  --max-cost <usd>       default 2
  --timeout <minutes>    default 30
  --environment <file>   use this environment config instead of the saved one
  --no-baseline-checks   don't run the checks before the agent
  --patch <file>         save the diff to a file
  --keep                 keep the sandbox for inspection
  --json                 print the result as JSON
  --help`;

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
        patch: { type: "string" },
        environment: { type: "string" },
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

  const source: RepoSource = parseSource(values.repo, values.ref, cwd);

  const timeoutMinutes = positiveNumber("--timeout", values.timeout);
  const limits: Partial<AgentLimits> = {};
  const maxSteps = positiveNumber("--max-steps", values["max-steps"]);
  const maxCost = positiveNumber("--max-cost", values["max-cost"]);
  if (maxSteps !== undefined) limits.maxSteps = Math.floor(maxSteps);
  if (maxCost !== undefined) limits.maxCostUsd = maxCost;
  if (timeoutMinutes !== undefined)
    limits.maxWallTimeMs = timeoutMinutes * 60_000;

  return {
    help: false,
    source,
    task: values.task
      ? { text: values.task }
      : { file: path.resolve(cwd, values["task-file"]!) },
    model: values.model,
    limits,
    environmentPath: values.environment
      ? path.resolve(cwd, values.environment)
      : undefined,
    baselineChecks: !values["no-baseline-checks"],
    patchPath: values.patch ? path.resolve(cwd, values.patch) : undefined,
    keep: values.keep,
    json: values.json,
  };
}
