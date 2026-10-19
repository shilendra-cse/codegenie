import path from "node:path";
import { resolveModel, type ResolvedModel } from "@codegenie/agent";
import { config as loadDotenv } from "dotenv";

/** Evals share the CLI's settings, so the API key lives in one place. */
export const ENV_FILE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "cli",
  ".env",
);

export function loadModel(override: string | undefined): ResolvedModel {
  loadDotenv({ path: ENV_FILE, quiet: true });
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(`OPENAI_API_KEY is not set. Add it to ${ENV_FILE}.`);
  }
  return resolveModel(
    override ?? process.env.AGENT_MODEL ?? "openai:gpt-6-luna",
  );
}
