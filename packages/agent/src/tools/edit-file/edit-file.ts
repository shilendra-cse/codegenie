import { tool } from "ai";
import { z } from "zod";
import { ToolError } from "../core/tool-error.js";
import { displayPath, resolveWorkspacePath } from "../core/workspace-path.js";
import type { ToolContext } from "../core/context.js";
import { editFileDescription } from "./description.js";
import { numberLines, splitLines } from "../../lib/lines.js";
import { runTool } from "../core/run-tool.js";

const SNIPPET_CONTEXT = 2;

export const editFileInput = z.object({
  path: z.string().describe("File to edit, relative to /workspace"),
  oldString: z.string().describe("Exact text to replace"),
  newString: z.string().describe("Text to put in its place"),
  replaceAll: z
    .boolean()
    .default(false)
    .describe("Replace every occurrence instead of requiring exactly one"),
});

function countOccurrences(content: string, search: string) {
  let count = 0;
  let index = content.indexOf(search);
  while (index !== -1) {
    count += 1;
    index = content.indexOf(search, index + search.length);
  }
  return count;
}

export async function editFile(
  ctx: ToolContext,
  input: z.input<typeof editFileInput>,
) {
  const { path, oldString, newString, replaceAll } = editFileInput.parse(input);
  const abs = resolveWorkspacePath(path, "write");
  const shown = displayPath(abs);

  if (oldString === "") {
    throw new ToolError(
      "oldString is empty. To create a file use write_file; to insert text, include the neighbouring lines in oldString.",
    );
  }
  if (oldString === newString) {
    throw new ToolError(
      "oldString and newString are identical; nothing to change.",
    );
  }
  if (!ctx.readFiles.has(abs)) {
    throw new ToolError(
      `Read ${shown} with read_file first, so your edit matches its current content.`,
    );
  }

  const content = await ctx.sandbox.readFile(abs);
  const count = countOccurrences(content, oldString);
  if (count === 0) {
    throw new ToolError(
      `oldString was not found in ${shown}. Check whitespace and indentation, re-read the file, and copy the exact text without the line-number prefix.`,
    );
  }
  if (count > 1 && !replaceAll) {
    throw new ToolError(
      `oldString matches ${count} places in ${shown}. Include more surrounding lines to make it unique, or set replaceAll to true.`,
    );
  }

  const firstIndex = content.indexOf(oldString);
  const updated = replaceAll
    ? content.split(oldString).join(newString)
    : content.replace(oldString, () => newString);
  await ctx.sandbox.writeFile(abs, updated);

  const lines = splitLines(updated);
  const editLine = content.slice(0, firstIndex).split("\n").length;
  const editedLineCount = splitLines(newString).length || 1;
  const from = Math.max(1, editLine - SNIPPET_CONTEXT);
  const to = Math.min(
    lines.length,
    editLine + editedLineCount - 1 + SNIPPET_CONTEXT,
  );
  const snippet = numberLines(lines.slice(from - 1, to), from);

  const replacements = replaceAll ? count : 1;
  return `Edited ${shown} (${replacements} replacement${replacements === 1 ? "" : "s"}).\n${snippet}`;
}

export const editFileTool = (ctx: ToolContext) =>
  tool({
    description: editFileDescription,
    inputSchema: editFileInput,
    execute: (input) => runTool(() => editFile(ctx, input)),
  });
