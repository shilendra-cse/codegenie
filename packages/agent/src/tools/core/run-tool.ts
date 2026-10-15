import { SandboxFileError } from "@codegenie/sandbox";
import { ToolError } from "./tool-error.js";
import { truncateForModel } from "../../lib/truncate.js";

/**
 * Runs a tool body and turns its result into text for the model.
 * Expected failures (ToolError, file errors) come back as "Error: …" so the model can retry.
 * Anything else — e.g. SandboxGoneError — is rethrown so the agent loop can stop the run.
 */
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
