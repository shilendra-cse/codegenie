import path from "node:path";
import { parseArgs } from "node:util";
import type { RepoSource } from "@codegenie/runner";
import { parseSource, UsageError, usageError } from "./common.js";

export type SetupOptions = {
  help: false;
  source: RepoSource;
  savePath: string;
  model?: string;
  yes: boolean;
};

export const SETUP_USAGE = `Usage: pnpm agent:setup --repo <path|git url> --save <file> [options]

Works out how to install and check the repository, asks you when it can't
decide, verifies the result in a fresh sandbox and saves it for agent:run
(--environment <file>).

  --repo <path|url>   local folder or public git URL (required)
  --ref <branch|tag>  branch or tag to clone (git URLs)
  --save <file>       where to save the environment config (required)
  --model <id>        catalog model for the setup agent (default: AGENT_MODEL)
  --yes               don't ask: take the recommended answers and save
  --help`;

export function parseSetupArgs(
  argv: string[],
  cwd: string,
): SetupOptions | { help: true } {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv[0] === "--" ? argv.slice(1) : argv,
      options: {
        repo: { type: "string" },
        ref: { type: "string" },
        save: { type: "string" },
        model: { type: "string" },
        yes: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw usageError(error);
  }
  if (values.help) return { help: true };

  const source = parseSource(values.repo, values.ref, cwd);
  if (!values.save) throw new UsageError("--save is required");
  return {
    help: false,
    source,
    savePath: path.resolve(cwd, values.save),
    model: values.model,
    yes: values.yes,
  };
}
