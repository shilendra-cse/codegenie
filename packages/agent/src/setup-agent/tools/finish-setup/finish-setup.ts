import { tool } from "ai";
import { z } from "zod";
import { proposalInput } from "../../schema.js";
import { finishSetupDescription } from "./description.js";

export const finishSetupInput = proposalInput.extend({
  notes: z.array(z.string()),
});

export const finishSetupTool = () =>
  tool({
    description: finishSetupDescription,
    inputSchema: finishSetupInput,
    execute: async () => "Setup finished.",
  });
