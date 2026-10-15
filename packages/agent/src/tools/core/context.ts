import type { Sandbox } from "@codegenie/sandbox";
import type { Check } from "@codegenie/shared";
import { OutputLog } from "./output-log.js";

/** State shared by all tools during one agent run. */
export type ToolContext = {
  sandbox: Sandbox;
  /** The repository's checks (from the runner's setup stage); run by run_checks. */
  checks: Check[];
  /** Absolute paths the agent has read (or written) this run; edits require a prior read. */
  readFiles: Set<string>;
  outputLog: OutputLog;
};

export function createToolContext(
  sandbox: Sandbox,
  checks: Check[] = [],
): ToolContext {
  return {
    sandbox,
    checks,
    readFiles: new Set(),
    outputLog: new OutputLog(),
  };
}
