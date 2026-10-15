import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { Compactor, compactBefore, estimateTokens } from "./compaction.js";

/** A history of `count` steps, each reading a file whose result is `size` characters. */
function history(count: number, size = 1_000): ModelMessage[] {
  const messages: ModelMessage[] = [{ role: "user", content: "the task" }];
  for (let i = 1; i <= count; i++) {
    messages.push({
      role: "assistant",
      content: [
        { type: "text", text: `step ${i}` },
        {
          type: "tool-call",
          toolCallId: `c${i}`,
          toolName: "read_file",
          input: { path: `src/f${i}.ts` },
        },
      ],
    });
    messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: `c${i}`,
          toolName: "read_file",
          output: { type: "text", value: "x".repeat(size) },
        },
      ],
    });
  }
  return messages;
}

function resultText(message: ModelMessage | undefined) {
  if (message?.role !== "tool") throw new Error("not a tool message");
  const part = message.content[0]!;
  if (part.type !== "tool-result" || part.output.type !== "text") {
    throw new Error("unexpected part");
  }
  return part.output.value;
}

describe("compactBefore", () => {
  it("replaces old tool results with a note, keeping calls, text and the task", () => {
    const messages = history(3);
    const compacted = compactBefore(messages, 3); // first step's result is index 2
    expect(resultText(compacted[2])).toBe(
      `[Output of read_file src/f1.ts removed to save context (${JSON.stringify({ type: "text", value: "x".repeat(1_000) }).length} characters). Run the tool again if you need it.]`,
    );
    expect(compacted[1]).toEqual(messages[1]); // the call is kept
    expect(compacted[0]).toEqual(messages[0]); // the task is kept
    expect(resultText(compacted[4])).toBe("x".repeat(1_000)); // later steps untouched
    expect(resultText(messages[2])).toBe("x".repeat(1_000)); // input not mutated
  });

  it("describes search and bash calls by pattern and command", () => {
    const messages: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "s",
            toolName: "search",
            input: { pattern: "router", path: "src" },
          },
          {
            type: "tool-call",
            toolCallId: "b",
            toolName: "bash",
            input: { command: "pnpm test" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "s",
            toolName: "search",
            output: { type: "text", value: "a" },
          },
          {
            type: "tool-result",
            toolCallId: "b",
            toolName: "bash",
            output: { type: "text", value: "b" },
          },
        ],
      },
    ];
    const json = JSON.stringify(compactBefore(messages, 2));
    expect(json).toContain('Output of search \\"router\\" removed');
    expect(json).toContain("Output of bash `pnpm test` removed");
  });
});

describe("Compactor", () => {
  // Window 10k → trigger 6k, target 4k tokens (~4 characters per token).
  const options = {
    contextWindow: 10_000,
    fixedChars: 0,
    keepRecentSteps: 10,
    minRecentSteps: 3,
  };

  it("leaves short conversations untouched", () => {
    const compactor = new Compactor(options);
    const messages = history(5);
    expect(compactor.apply(messages)).toBe(messages);
    expect(compactor.compactions).toBe(0);
  });

  it("compacts in one batch to under the target, then keeps the same prefix until the next trigger", () => {
    // Window 20k → trigger 12k, target 8k tokens: room to keep 10 full steps.
    const compactor = new Compactor({ ...options, contextWindow: 20_000 });
    let messages = history(40);
    expect(estimateTokens(messages)).toBeGreaterThan(12_000);

    const first = compactor.apply(messages);
    expect(compactor.compactions).toBe(1);
    expect(estimateTokens(first)).toBeLessThanOrEqual(8_000);
    // The last 10 steps (20 messages) are intact.
    expect(resultText(first.at(-1))).toBe("x".repeat(1_000));
    expect(resultText(first.at(-19))).toBe("x".repeat(1_000));

    // Two more steps: no new compaction, and the compacted prefix is byte-identical.
    messages = history(42);
    const second = compactor.apply(messages);
    expect(compactor.compactions).toBe(1);
    expect(JSON.stringify(second.slice(0, first.length))).toBe(
      JSON.stringify(first),
    );
  });

  it("keeps fewer recent steps when the last 10 alone are too big", () => {
    const compactor = new Compactor(options);
    const messages = history(12, 2_500); // 10 steps × 2.5k chars ≈ 6.4k tokens > 4k target
    const view = compactor.apply(messages);
    const intact = view.filter(
      (m) => m.role === "tool" && resultText(m) === "x".repeat(2_500),
    ).length;
    expect(intact).toBeLessThan(10);
    expect(intact).toBeGreaterThanOrEqual(3);
  });
});
