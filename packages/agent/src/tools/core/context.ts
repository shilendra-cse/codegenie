import type { Sandbox } from "@codegenie/sandbox";
import { OutputLog } from "./output-log.js";

export const CHECK_NAMES = ["lint", "typecheck", "test", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];
/** Shell commands for the repo's checks, filled in by setup detection (step 4). */
export type CheckCommands = Partial<Record<CheckName, string>>;

/** State shared by all tools during one agent run. */
export type ToolContext = {
  sandbox: Sandbox;
  commands: CheckCommands;
  /** Absolute paths the agent has read (or written) this run; edits require a prior read. */
  readFiles: Set<string>;
  outputLog: OutputLog;
};

export function createToolContext(
  sandbox: Sandbox,
  commands: CheckCommands = {},
): ToolContext {
  return {
    sandbox,
    commands,
    readFiles: new Set(),
    outputLog: new OutputLog(),
  };
}
