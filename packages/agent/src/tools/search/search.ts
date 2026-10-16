import { WORKSPACE_DIR } from "@codegenie/sandbox";
import { tool } from "ai";
import { z } from "zod";
import { shellJoin } from "../../lib/shell-quote.js";
import { ToolError } from "../core/tool-error.js";
import { resolveWorkspacePath } from "../core/workspace-path.js";
import type { ToolContext } from "../core/context.js";
import { searchDescription } from "./description.js";
import { runTool } from "../core/run-tool.js";

const MAX_MATCHES = 100;

export const searchInput = z.object({
  pattern: z.string().min(1).describe("Regular expression (ripgrep syntax)"),
  path: z
    .string()
    .default(".")
    .describe("Folder or file to search, relative to /workspace"),
  glob: z
    .string()
    .optional()
    .describe('Only search files matching this glob, e.g. "*.ts"'),
  ignoreCase: z.boolean().default(false),
});

export async function search(
  ctx: ToolContext,
  input: z.input<typeof searchInput>,
) {
  const { pattern, path, glob, ignoreCase } = searchInput.parse(input);
  const abs = resolveWorkspacePath(path, "read");

  const command = shellJoin([
    "rg",
    "--line-number",
    "--no-heading",
    "--color=never",
    "--max-columns=300",
    "--max-columns-preview",
    "--hidden",
    "--glob=!.git",
    ...(glob ? [`--glob=${glob}`] : []),
    ...(ignoreCase ? ["--ignore-case"] : []),
    "--",
    pattern,
    abs,
  ]);
  const result = await ctx.sandbox.exec(command, { timeoutMs: 60_000 });

  if (result.exitCode === 1)
    return `No matches for ${JSON.stringify(pattern)}.`;
  if (result.exitCode !== 0) {
    throw new ToolError(
      `search failed: ${result.stderr.trim() || `exit code ${result.exitCode}`}`,
    );
  }

  const prefix = `${WORKSPACE_DIR}/`;
  const matches = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) =>
      line.startsWith(prefix) ? line.slice(prefix.length) : line,
    );

  const shown = matches.slice(0, MAX_MATCHES);
  if (matches.length > MAX_MATCHES) {
    shown.push(
      `… ${matches.length - MAX_MATCHES} more matches. Narrow the search with path or glob.`,
    );
  }
  return shown.join("\n");
}

export const searchTool = (ctx: ToolContext) =>
  tool({
    description: searchDescription,
    inputSchema: searchInput,
    execute: (input) => runTool(() => search(ctx, input)),
  });
