import { tool } from "ai";
import { z } from "zod";
import { ToolError } from "../core/tool-error.js";
import { displayPath, resolveWorkspacePath } from "../core/workspace-path.js";
import type { ToolContext } from "../core/context.js";
import { readFileDescription } from "./description.js";
import { runTool } from "../core/run-tool.js";
import { numberLines, splitLines } from "../../lib/lines.js";

export const MAX_READ_LINES = 2000;

export const readFileInput = z.object({
  path: z.string().describe("File to read, relative to /workspace"),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based line number to start from"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_READ_LINES)
    .default(MAX_READ_LINES)
    .describe("Maximum number of lines to read"),
});

export async function readFile(
  ctx: ToolContext,
  input: z.input<typeof readFileInput>,
) {
  const { path, offset, limit } = readFileInput.parse(input);
  const abs = resolveWorkspacePath(path, "read");
  const content = await ctx.sandbox.readFile(abs);

  if (content.includes("\0")) {
    throw new ToolError(
      `${displayPath(abs)} looks like a binary file and can't be read as text.`,
    );
  }
  ctx.readFiles.add(abs);

  const lines = splitLines(content);
  const total = lines.length;
  if (total === 0) return `${displayPath(abs)} — empty file`;

  const start = offset ?? 1;
  if (start > total) {
    throw new ToolError(
      `offset ${start} is past the end of ${displayPath(abs)} (${total} lines).`,
    );
  }
  const end = Math.min(total, start + limit - 1);
  const more = end < total ? ` (use offset=${end + 1} to continue)` : "";
  const header = `${displayPath(abs)} — lines ${start}–${end} of ${total}${more}`;
  return `${header}\n${numberLines(lines.slice(start - 1, end), start)}`;
}

export const readFileTool = (ctx: ToolContext) =>
  tool({
    description: readFileDescription,
    inputSchema: readFileInput,
    execute: (input) => runTool(() => readFile(ctx, input)),
  });
