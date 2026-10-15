import { describe, expect, it } from "vitest";
import { EVENT_OUTPUT_CHARS, toJobEvent } from "./events.js";

const ts = "2026-10-15T00:00:00.000Z";

describe("toJobEvent", () => {
  it("maps text, tool calls, results and errors", () => {
    expect(
      toJobEvent({ type: "text-delta", id: "t", text: "Hi" }, "run-1", ts),
    ).toEqual({
      type: "text_delta",
      jobId: "run-1",
      ts,
      delta: "Hi",
    });
    expect(
      toJobEvent(
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "read_file",
          input: { path: "a.ts" },
        },
        "run-1",
        ts,
      ),
    ).toEqual({
      type: "tool_start",
      jobId: "run-1",
      ts,
      toolCallId: "c1",
      toolName: "read_file",
      input: { path: "a.ts" },
    });
    expect(
      toJobEvent(
        {
          type: "tool-result",
          toolCallId: "c1",
          toolName: "read_file",
          input: {},
          output: "content",
        },
        "run-1",
        ts,
      ),
    ).toMatchObject({ type: "tool_end", toolCallId: "c1", output: "content" });
    expect(
      toJobEvent(
        {
          type: "tool-error",
          toolCallId: "c2",
          toolName: "bash",
          input: {},
          error: new Error("boom"),
        },
        "run-1",
        ts,
      ),
    ).toMatchObject({
      type: "tool_end",
      toolCallId: "c2",
      output: "Error: boom",
    });
  });

  it("shortens large tool output in events", () => {
    const event = toJobEvent(
      {
        type: "tool-result",
        toolCallId: "c",
        toolName: "bash",
        input: {},
        output: "x".repeat(5_000),
      },
      "run-1",
      ts,
    );
    expect(event).toMatchObject({ type: "tool_end" });
    const output = (event as { output: string }).output;
    expect(output.startsWith("x".repeat(EVENT_OUTPUT_CHARS))).toBe(true);
    expect(output).toContain("[3000 more characters]");
  });

  it("ignores parts the UI doesn't need", () => {
    expect(toJobEvent({ type: "start" }, "run-1", ts)).toBeNull();
    expect(
      toJobEvent({ type: "text-delta", id: "t", text: "" }, "run-1", ts),
    ).toBeNull();
  });
});
