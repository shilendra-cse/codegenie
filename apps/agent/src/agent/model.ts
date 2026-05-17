import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { config } from "../config/index.js";

const glm = createOpenAI({
  apiKey: config.zai.apiKey,
  baseURL: "https://api.z.ai/api/coding/paas/v4/",
});

export const model: LanguageModel = glm.chat("glm-4.6");
