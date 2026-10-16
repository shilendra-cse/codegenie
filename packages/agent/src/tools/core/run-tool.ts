import { SandboxFileError } from "@codegenie/sandbox";
import { ToolError } from "./tool-error.js";
import { truncateForModel } from "../../lib/truncate.js";

export async function runTool(body: () => Promise<string>): Promise<string> {
  try {
    return truncateForModel(await body()).text;
  } catch (error) {
    if (error instanceof ToolError || error instanceof SandboxFileError) {
      return `Error: ${error.message}`;
    }
    throw error;
  }
}
