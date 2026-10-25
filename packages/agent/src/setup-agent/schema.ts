import { CHECK_NAMES } from "@hobai/shared";
import { z } from "zod";

const cwd = z
  .string()
  .trim()
  .min(1)
  .describe('Folder relative to the repository root; "." for the root');
const command = z.string().trim().min(1);

export const proposalInput = z.object({
  steps: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1)
          .describe('Short name, e.g. "install" or "generate"'),
        cwd,
        command,
      }),
    )
    .describe(
      "Run in order before the checks, e.g. installs and code generation",
    ),
  checks: z
    .array(z.object({ name: z.enum(CHECK_NAMES), cwd, command }))
    .describe("At most one check of each name per folder"),
});
