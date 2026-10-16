import { tool } from "ai";
import { z } from "zod";
import { logSize, wrapWithLog } from "../core/output-log.js";
import { truncateForModel } from "../../lib/truncate.js";
import type { ToolContext } from "../core/context.js";
import { bashDescription } from "./description.js";
import { runTool } from "../core/run-tool.js";

const MAX_OUTPUT_CHARS = 28_000;

export const bashInput = z.object({
  command: z.string().min(1).describe("Shell command to run in /workspace"),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(600_000)
    .optional()
    .describe("Timeout in milliseconds (default 120000, max 600000)"),
});

export async function bash(ctx: ToolContext, input: z.input<typeof bashInput>) {
  const { command, timeoutMs } = bashInput.parse(input);
  const logPath = ctx.outputLog.nextPath("bash");
  const result = await ctx.sandbox.exec(wrapWithLog(command, logPath), {
    timeoutMs,
  });

  const raw = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const output = truncateForModel(raw, { maxChars: MAX_OUTPUT_CHARS });

  const parts = [`Exit code: ${result.exitCode}`];
  if (result.timedOut) {
    const seconds = Math.round((timeoutMs ?? 120_000) / 1000);
    parts.push(`Command timed out after ${seconds}s and was stopped.`);
  }
  parts.push(output.text.trimEnd() || "(no output)");
  if (output.truncated || result.truncated) {
    const size = await logSize(ctx.sandbox, logPath);
    parts.push(
      `Output was shortened. Full output${size ? ` (${size})` : ""} saved to ${logPath}; use search or read_file with offset to inspect it.`,
    );
  }
  return parts.join("\n");
}

export const bashTool = (ctx: ToolContext) =>
  tool({
    description: bashDescription,
    inputSchema: bashInput,
    execute: (input) => runTool(() => bash(ctx, input)),
  });
