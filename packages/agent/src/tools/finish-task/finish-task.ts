import { tool } from "ai";
import { z } from "zod";
import { finishTaskDescription } from "./description.js";

export const finishTaskInput = z.object({
  summary: z
    .string()
    .min(1)
    .describe("What you changed and why, for the user and the pull request"),
});

/** Ends the run. The agent loop (step 3) watches for this call and reads the summary. */
export const finishTaskTool = () =>
  tool({
    description: finishTaskDescription,
    inputSchema: finishTaskInput,
    execute: async () => "Task marked complete.",
  });
