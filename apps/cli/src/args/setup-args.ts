import path from "node:path";
import { parseArgs } from "node:util";
import type { RepoSource } from "@hobai/runner";
import { SHORT_NAME } from "@hobai/shared/brand";
import { parseSource, UsageError, usageError } from "./common.js";

export type SetupOptions = {
  help: false;
  source: RepoSource;
  /** Also write the approved config to this file. */
  savePath?: string;
  model?: string;
  yes: boolean;
  /** Only print the saved environment. */
  show: boolean;
};

export const SETUP_USAGE = `Usage: pnpm agent:setup --repo <path|git url> [options]

Works out how to install and check the repository, asks you when it can't
decide, verifies the result in a fresh sandbox and saves it as the repository's
environment, which agent:run then uses (~/.${SHORT_NAME}/environments, last 5 versions).

  --repo <path|url>   local folder or public git URL (required)
  --ref <branch|tag>  branch or tag to clone (git URLs)
  --show              only show the saved environment: version, health, steps, checks
  --save <file>       also write the environment config to this file
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
        show: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw usageError(error);
  }
  if (values.help) return { help: true };

  const source = parseSource(values.repo, values.ref, cwd);
  if (values.show && (values.save || values.yes || values.model)) {
    throw new UsageError(
      "--show only shows the saved environment; drop --save, --yes and --model",
    );
  }
  return {
    help: false,
    source,
    savePath: values.save ? path.resolve(cwd, values.save) : undefined,
    model: values.model,
    yes: values.yes,
    show: values.show,
  };
}
