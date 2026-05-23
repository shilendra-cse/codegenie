import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { config } from "../config/index.js";

const openai = createOpenAI({
  apiKey: config.openai.apiKey,
});

export const model: LanguageModel = openai.chat("gpt-4");
