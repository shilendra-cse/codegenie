import { tool } from "ai";
import type { z } from "zod";
import { runTool } from "../../../tools/core/run-tool.js";
import type { SetupToolContext } from "../../context.js";
import { formatTryResult } from "../../format.js";
import { proposalInput } from "../../schema.js";
import { tryEnvironmentDescription } from "./description.js";

export async function tryEnvironment(
  ctx: SetupToolContext,
  input: z.input<typeof proposalInput>,
) {
  return formatTryResult(await ctx.tryEnvironment(proposalInput.parse(input)));
}

export const tryEnvironmentTool = (ctx: SetupToolContext) =>
  tool({
    description: tryEnvironmentDescription,
    inputSchema: proposalInput,
    execute: (input) => runTool(() => tryEnvironment(ctx, input)),
  });
