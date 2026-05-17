import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const glm = createOpenAI({
  apiKey: process.env.ZAI_API_KEY!,
  baseURL: "https://api.z.ai/api/coding/paas/v4/",
});

export const model: LanguageModel = glm.chat("glm-4.6");
