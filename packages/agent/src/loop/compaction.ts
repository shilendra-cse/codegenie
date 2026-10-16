import type { ModelMessage } from "ai";

const CHARS_PER_TOKEN = 4;

export type CompactorOptions = {
  contextWindow: number;
  fixedChars: number;
  triggerRatio?: number;
  targetRatio?: number;
  keepRecentSteps?: number;
  minRecentSteps?: number;
};

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

// Compacts rarely and in one batch, and keeps the cut-off (watermark) fixed in between, so the prompt prefix stays identical and cacheable.
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

  get compactions() {
    return this.count;
  }

  apply(messages: ModelMessage[]): ModelMessage[] {
    const view = compactBefore(messages, this.watermark);
    if (estimateTokens(view, this.options.fixedChars) <= this.trigger) {
      return view;
    }

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
