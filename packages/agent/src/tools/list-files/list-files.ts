import { tool } from "ai";
import { z } from "zod";
import { displayPath, resolveWorkspacePath } from "../core/workspace-path.js";
import type { ToolContext } from "../core/context.js";
import { listFilesDescription } from "./description.js";
import { runTool } from "../core/run-tool.js";

const MAX_ENTRIES = 500;

export const listFilesInput = z.object({
  path: z
    .string()
    .default(".")
    .describe("Folder to list, relative to /workspace"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(2)
    .describe("Levels to descend"),
});

export async function listFiles(
  ctx: ToolContext,
  input: z.input<typeof listFilesInput>,
) {
  const { path, depth } = listFilesInput.parse(input);
  const abs = resolveWorkspacePath(path, "read");
  const entries = await ctx.sandbox.listFiles(abs, { maxDepth: depth });

  const header = `${displayPath(abs)}/`;
  if (entries.length === 0) return `${header}\n(empty)`;

  const lines = entries.slice(0, MAX_ENTRIES).map((entry) => {
    const relative = entry.path.slice(abs.length + 1);
    const level = relative.split("/").length - 1;
    const name = relative.split("/").pop();
    return `${"  ".repeat(level + 1)}${name}${entry.isDirectory ? "/" : ""}`;
  });
  if (entries.length > MAX_ENTRIES) {
    lines.push(
      `… ${entries.length - MAX_ENTRIES} more entries. List a subfolder or use a smaller depth.`,
    );
  }
  return [header, ...lines].join("\n");
}

export const listFilesTool = (ctx: ToolContext) =>
  tool({
    description: listFilesDescription,
    inputSchema: listFilesInput,
    execute: (input) => runTool(() => listFiles(ctx, input)),
  });
