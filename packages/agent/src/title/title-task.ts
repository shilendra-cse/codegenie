import { streamText } from "ai";
import type { ResolvedModel } from "../model/resolve-model.js";
import { UsageTracker, type UsageSnapshot } from "../model/usage.js";

const MAX_LENGTH = 60;
const MAX_PROMPT = 4_000;
const TIMEOUT_MS = 10_000;

const SYSTEM = [
  "You name coding tasks for a list of tasks and a git branch.",
  "Reply with only the title: 3 to 6 words, sentence case, starting with a verb, no quotes and no full stop.",
  'Name the change, not the request: "Add AWS skills to the profile", not "Can you add a skill".',
].join("\n");

export type TaskTitle = { title: string | null; usage: UsageSnapshot };

/** Tidies the model's answer into a title, or null when there's nothing usable. */
export function cleanTitle(answer: string): string | null {
  const line = answer
    .trim()
    .split("\n")[0]!
    .replace(/^title:\s*/i, "")
    .replace(/^["'`*]+|["'`*]+$/g, "")
    .replace(/[.!]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z]/i.test(line)) return null;
  const title =
    line.length <= MAX_LENGTH
      ? line
      : line
          .slice(0, line.lastIndexOf(" ", MAX_LENGTH) + 1 || MAX_LENGTH)
          .trim();
  return title[0]!.toUpperCase() + title.slice(1);
}

/**
 * Asks the model for a short title for a task. Never throws: a failed, slow or unusable answer
 * gives a null title, and the caller keeps the one it has.
 */
export async function titleTask(
  model: ResolvedModel,
  prompt: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<TaskTitle> {
  const usage = new UsageTracker(model.spec.pricing);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  try {
    const result = streamText({
      model: model.languageModel,
      system: SYSTEM,
      prompt: prompt.slice(0, MAX_PROMPT),
      abortSignal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
      maxRetries: 1,
      onError: () => {},
    });
    const text = await result.text;
    usage.add(await result.usage);
    return { title: cleanTitle(text), usage: usage.snapshot() };
  } catch {
    return { title: null, usage: usage.snapshot() };
  }
}
