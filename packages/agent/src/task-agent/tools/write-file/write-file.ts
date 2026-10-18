import { SandboxFileError } from "@codegenie/sandbox";
import { tool } from "ai";
import { z } from "zod";
import { ToolError } from "../../../tools/core/tool-error.js";
import {
  displayPath,
  resolveWorkspacePath,
} from "../../../tools/core/workspace-path.js";
import type { ToolContext } from "../../../tools/core/context.js";
import { writeFileDescription } from "./description.js";
import { splitLines } from "../../../lib/lines.js";
import { runTool } from "../../../tools/core/run-tool.js";

export const writeFileInput = z.object({
  path: z.string().describe("File to write, relative to /workspace"),
  content: z.string().describe("Complete new content of the file"),
});

async function fileExists(ctx: ToolContext, abs: string) {
  try {
    await ctx.sandbox.readFile(abs);
    return true;
  } catch (error) {
    if (error instanceof SandboxFileError) return false;
    throw error;
  }
}

export async function writeFile(
  ctx: ToolContext,
  input: z.input<typeof writeFileInput>,
) {
  const { path, content } = writeFileInput.parse(input);
  const abs = resolveWorkspacePath(path, "write");
  const shown = displayPath(abs);

  const exists = await fileExists(ctx, abs);
  if (exists && !ctx.readFiles.has(abs)) {
    throw new ToolError(
      `${shown} already exists. Read it with read_file before overwriting it, or use edit_file for partial changes.`,
    );
  }

  await ctx.sandbox.writeFile(abs, content);
  ctx.readFiles.add(abs);
  const lines = splitLines(content).length;
  return `${exists ? "Overwrote" : "Created"} ${shown} (${lines} line${lines === 1 ? "" : "s"}).`;
}

export const writeFileTool = (ctx: ToolContext) =>
  tool({
    description: writeFileDescription,
    inputSchema: writeFileInput,
    execute: (input) => runTool(() => writeFile(ctx, input)),
  });
