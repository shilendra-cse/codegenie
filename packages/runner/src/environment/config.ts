import { CHECK_NAMES, type EnvironmentConfig } from "@codegenie/shared";
import { z } from "zod";

const command = z.string().trim().min(1);
const cwd = z.string().trim().min(1);

const schema = z.object({
  version: z.literal(1),
  steps: z.array(z.object({ name: z.string().trim().min(1), cwd, command })),
  checks: z.array(z.object({ name: z.enum(CHECK_NAMES), cwd, command })),
  meta: z.object({
    source: z.enum(["detected", "ai", "user", "mixed"]),
    createdAt: z.string(),
    commit: z.string().optional(),
    decisions: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
          auto: z.boolean(),
        }),
      )
      .default([]),
    validation: z
      .object({
        steps: z.record(z.string(), z.enum(["ok", "failed"])),
        checks: z.record(
          z.string(),
          z.enum(["passing", "failing", "broken", "timed-out"]),
        ),
      })
      .optional(),
  }),
});

export class EnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigError";
  }
}

export function parseEnvironmentConfig(input: unknown): EnvironmentConfig {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new EnvironmentConfigError(`Invalid environment config:\n${issues}`);
  }
  return parsed.data;
}
