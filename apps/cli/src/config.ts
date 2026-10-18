import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { resolveModel, type ResolvedModel } from "@codegenie/agent";
import { z } from "zod";

export const ENV_FILE = path.join(import.meta.dirname, "..", ".env");
const PLACEHOLDER_KEY = "your-openai-api-key";

const schema = z.object({
  OPENAI_API_KEY: z
    .string({ error: `OPENAI_API_KEY is not set. Add it to ${ENV_FILE}.` })
    .min(1, `OPENAI_API_KEY is empty. Add it to ${ENV_FILE}.`)
    .refine((key) => key !== PLACEHOLDER_KEY, {
      message: `OPENAI_API_KEY is still the placeholder. Set your key in ${ENV_FILE}.`,
    }),
  AGENT_MODEL: z.string().min(1).default("openai:gpt-6-luna"),
});

export type CliConfig = { model: string };

export class ConfigError extends Error {}

export function loadEnvFile() {
  loadDotenv({ path: ENV_FILE, quiet: true });
}

export function parseConfig(
  env: Record<string, string | undefined>,
): CliConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => i.message).join("\n"));
  }
  return { model: parsed.data.AGENT_MODEL };
}

/** Reads apps/cli/.env and resolves the model to use (the flag wins over AGENT_MODEL). */
export function loadModel(override: string | undefined): ResolvedModel {
  loadEnvFile();
  return resolveModel(override ?? parseConfig(process.env).model);
}
