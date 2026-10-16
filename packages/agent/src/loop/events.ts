import type { JobEvent } from "@codegenie/shared";
import type { TextStreamPart, ToolSet } from "ai";

export const EVENT_OUTPUT_CHARS = 2_000;

export type Emit = (event: JobEvent) => void;

function preview(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > EVENT_OUTPUT_CHARS
    ? `${text.slice(0, EVENT_OUTPUT_CHARS)}… [${text.length - EVENT_OUTPUT_CHARS} more characters]`
    : text;
}

export function toJobEvent(
  part: TextStreamPart<ToolSet>,
  jobId: string,
  ts: string = new Date().toISOString(),
): JobEvent | null {
  switch (part.type) {
    case "text-delta":
      return part.text
        ? { type: "text_delta", jobId, ts, delta: part.text }
        : null;
    case "tool-call":
      return {
        type: "tool_start",
        jobId,
        ts,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
      };
    case "tool-result":
      return {
        type: "tool_end",
        jobId,
        ts,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: preview(part.output),
      };
    case "tool-error":
      return {
        type: "tool_end",
        jobId,
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
