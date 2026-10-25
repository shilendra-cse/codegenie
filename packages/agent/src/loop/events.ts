import type { RunEvent } from "@hobai/shared";
import type { TextStreamPart, ToolSet } from "ai";

export const EVENT_OUTPUT_CHARS = 2_000;

export type Emit = (event: RunEvent) => void;

function preview(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > EVENT_OUTPUT_CHARS
    ? `${text.slice(0, EVENT_OUTPUT_CHARS)}… [${text.length - EVENT_OUTPUT_CHARS} more characters]`
    : text;
}

export function toRunEvent(
  part: TextStreamPart<ToolSet>,
  runId: string,
  ts: string = new Date().toISOString(),
): RunEvent | null {
  switch (part.type) {
    case "text-delta":
      return part.text
        ? { type: "text_delta", runId, ts, delta: part.text }
        : null;
    case "tool-call":
      return {
        type: "tool_start",
        runId,
        ts,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
      };
    case "tool-result":
      return {
        type: "tool_end",
        runId,
        ts,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: preview(part.output),
      };
    case "tool-error":
      return {
        type: "tool_end",
        runId,
        ts,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: preview(
          `Error: ${part.error instanceof Error ? part.error.message : String(part.error)}`,
        ),
      };
    default:
      return null;
  }
}
