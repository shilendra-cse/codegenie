import type { Sandbox } from "@hobai/sandbox";
import type { Check } from "@hobai/shared";
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
