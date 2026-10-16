import type { Sandbox } from "@codegenie/sandbox";
import type { Check } from "@codegenie/shared";
import { OutputLog } from "./output-log.js";

export type ToolContext = {
  sandbox: Sandbox;
  checks: Check[];
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
