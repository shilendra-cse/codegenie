import { parseArgs } from "node:util";

export class UsageError extends Error {}

export type EvalOptions = {
  help: false;
  tasks: string[];
  repos: string[];
  repeat: number;
  concurrency: number;
  onboard: boolean;
  model?: string;
};

export const USAGE = `Usage: pnpm eval [options]

Runs the eval tasks in apps/evals/repos/*/tasks and writes a report to apps/evals/results/.
Uses the model and API key from apps/cli/.env. Costs money: each task is a real agent run.

  --task <repo/task>   run only this task, e.g. ts-lib/paginate-bug; repeatable
  --repo <name>        run only this repository's tasks; repeatable
  --repeat <n>         run each task n times (default 1)
  --concurrency <n>    tasks running at the same time (default 2)
  --onboard            onboard the repositories again instead of using the saved environments
  --model <id>         catalog model (default: AGENT_MODEL)
  --help`;

function positiveInteger(
  flag: string,
  value: string | undefined,
  fallback: number,
) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new UsageError(`${flag} must be a whole number of at least 1`);
  }
  return number;
}

export function parseEvalArgs(argv: string[]): EvalOptions | { help: true } {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv[0] === "--" ? argv.slice(1) : argv,
      options: {
        task: { type: "string", multiple: true },
        repo: { type: "string", multiple: true },
        repeat: { type: "string" },
        concurrency: { type: "string" },
        onboard: { type: "boolean", default: false },
        model: { type: "string" },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw new UsageError(
      error instanceof Error ? error.message : String(error),
    );
  }
  if (values.help) return { help: true };
  return {
    help: false,
    tasks: values.task ?? [],
    repos: values.repo ?? [],
    repeat: positiveInteger("--repeat", values.repeat, 1),
    concurrency: positiveInteger("--concurrency", values.concurrency, 2),
    onboard: values.onboard,
    model: values.model,
  };
}
