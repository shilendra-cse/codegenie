import type { ModelMessage } from "ai";

const CHARS_PER_TOKEN = 4;

export type CompactorOptions = {
  contextWindow: number;
  /** Characters sent with every request besides the messages (system prompt, tool definitions). */
  fixedChars: number;
  /** Compact when the prompt is estimated above this share of the window. Default 0.6. */
  triggerRatio?: number;
  /** Compact down to this share of the window. Default 0.4. */
  targetRatio?: number;
  /** Steps kept in full when compacting. Default 10. */
  keepRecentSteps?: number;
  /** Never keep fewer steps than this in full. Default 3. */
  minRecentSteps?: number;
};

/** Rough token estimate: good enough to decide when to compact. */
export function estimateTokens(messages: ModelMessage[], fixedChars = 0) {
  return Math.ceil(
    (JSON.stringify(messages).length + fixedChars) / CHARS_PER_TOKEN,
  );
}

function describeCall(toolName: string, input: unknown) {
  const args = (input ?? {}) as Record<string, unknown>;
  const detail =
    typeof args.path === "string" && toolName !== "search"
      ? args.path
      : typeof args.pattern === "string"
        ? JSON.stringify(args.pattern)
        : typeof args.command === "string"
          ? `\`${args.command.length > 80 ? `${args.command.slice(0, 80)}…` : args.command}\``
          : "";
  return detail ? `${toolName} ${detail}` : toolName;
}

/**
 * Returns a copy of `messages` where tool results before index `upTo` are replaced by a
 * one-line note. Tool calls, the task and the model's own text are kept, so the model
 * still knows what it did. Deterministic: the same input always gives the same output.
 */
export function compactBefore(
  messages: ModelMessage[],
  upTo: number,
): ModelMessage[] {
  if (upTo <= 0) return messages;

  const calls = new Map<string, { toolName: string; input: unknown }>();
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-call") {
        calls.set(part.toolCallId, {
          toolName: part.toolName,
          input: part.input,
        });
      }
    }
  }

  return messages.map((message, index) => {
    if (index >= upTo || message.role !== "tool") return message;
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== "tool-result") return part;
        const call = calls.get(part.toolCallId);
        const what = call
          ? describeCall(call.toolName, call.input)
          : part.toolName;
        const size = JSON.stringify(part.output).length;
        return {
          ...part,
          output: {
            type: "text" as const,
            value: `[Output of ${what} removed to save context (${size} characters). Run the tool again if you need it.]`,
          },
        };
      }),
    };
  });
}

/**
 * Cache-friendly context compaction.
 *
 * Providers discount a repeated prompt prefix, and any change to earlier messages loses
 * that discount. So compaction happens rarely and in one big batch: when the prompt
 * passes the trigger share of the window, old tool results are replaced until it is
 * under the target share. The cut-off (watermark) is remembered and only moves at the
 * next compaction, so between compactions every request starts with the same prefix.
 */
export class Compactor {
  private watermark = 0;
  private count = 0;
  private readonly trigger: number;
  private readonly target: number;
  private readonly keepRecent: number;
  private readonly minRecent: number;

  constructor(private readonly options: CompactorOptions) {
    this.trigger = options.contextWindow * (options.triggerRatio ?? 0.6);
    this.target = options.contextWindow * (options.targetRatio ?? 0.4);
    this.keepRecent = options.keepRecentSteps ?? 10;
    this.minRecent = options.minRecentSteps ?? 3;
  }

  /** Number of compactions so far. */
  get compactions() {
    return this.count;
  }

  /** Messages to send for this step. `messages` is always the full, original history. */
  apply(messages: ModelMessage[]): ModelMessage[] {
    const view = compactBefore(messages, this.watermark);
    if (estimateTokens(view, this.options.fixedChars) <= this.trigger) {
      return view;
    }

    // A step starts with an assistant message; keep the last N steps in full.
    const stepStarts = messages.flatMap((m, i) =>
      m.role === "assistant" ? [i] : [],
    );
    let next = this.watermark;
    for (let keep = this.keepRecent; keep >= this.minRecent; keep--) {
      if (stepStarts.length <= keep) continue;
      const candidate = stepStarts[stepStarts.length - keep]!;
      if (candidate <= this.watermark) continue;
      next = candidate;
      const compacted = compactBefore(messages, candidate);
      if (estimateTokens(compacted, this.options.fixedChars) <= this.target) {
        break;
      }
    }

    if (next === this.watermark) return view;
    this.watermark = next;
    this.count += 1;
    return compactBefore(messages, next);
  }
}
