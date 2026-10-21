import { tool } from "ai";
import { z } from "zod";
import { finishTaskDescription } from "./description.js";

export const finishTaskInput = z.object({
  title: z
    .string()
    .optional()
    .describe(
      'Short title for the change, imperative and under 72 characters, e.g. "Add a GET /health endpoint"',
    ),
  summary: z
    .string()
    .min(1)
    .describe("What you changed and why, for the user and the pull request"),
});

export const finishTaskTool = () =>
  tool({
    description: finishTaskDescription,
    inputSchema: finishTaskInput,
    execute: async () => "Task marked complete.",
  });
