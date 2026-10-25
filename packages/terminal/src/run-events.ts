import type { CheckStatus, RunEvent } from "@hobai/shared";
import { oneLine } from "./format.js";
import { line, section } from "./layout.js";
import type { Style } from "./style.js";
import { SYMBOLS } from "./symbols.js";

const STAGE_TITLE: Record<string, string> = {
  prepare: "Sandbox",
  checkout: "Checkout",
  setup: "Setup",
  agent: "Agent",
  verify: "Verify",
};

const TOOL_NAME_WIDTH = 15;

const labelled = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? item.name : `${item.name} (${item.cwd})`;

/** Status before the agent's changes: failing here means already failing, not the agent's doing. */
function checkBefore(style: Style, status: CheckStatus | undefined) {
  switch (status) {
    case undefined:
      return "";
    case "passing":
      return style.ok(SYMBOLS.ok);
    case "failing":
      return style.warn(`${SYMBOLS.fail} failing`);
    case "broken":
      return style.warn(`${SYMBOLS.warn} broken`);
    case "timed-out":
      return style.warn(`${SYMBOLS.warn} timed out`);
  }
}

/** Colors the ✓ / ✗ / ⚠ at the start of a result line. */
function markLine(style: Style, text: string) {
  const mark = text[0];
  const rest = text.slice(1);
  if (mark === SYMBOLS.ok) return style.ok(mark) + rest;
  if (mark === SYMBOLS.fail) return style.fail(mark) + rest;
  if (mark === SYMBOLS.warn) return style.warn(mark) + rest;
  return text;
}

export function describeToolInput(input: unknown) {
  const args = (input ?? {}) as Record<string, unknown>;
  for (const key of ["path", "pattern", "command", "question"]) {
    if (typeof args[key] === "string") return oneLine(args[key] as string, 100);
  }
  return "";
}

/**
 * Turns run events into lines: a section per stage, tool calls, check results and
 * the agent's notes. Used for the CLI's live output and the evals' log files.
 */
export function createRunReporter(write: (line: string) => void, style: Style) {
  let text = "";
  const flushText = () => {
    if (text.trim()) write(line(style, style.dim(`“${oneLine(text)}”`)));
    text = "";
  };

  return {
    onEvent(event: RunEvent) {
      if (event.type === "text_delta") {
        text += event.delta;
        return;
      }
      if (event.type === "agent_step") return;
      // Environment setup prints its own progress; these reports are for the website.
      if (event.type === "setup_drafted") return;
      if (event.type === "setup_completed" && event.phase) return;
      flushText();
      switch (event.type) {
        case "stage_changed":
          write(section(style, STAGE_TITLE[event.stage] ?? event.stage));
          break;
        case "sandbox_created":
          write(line(style, style.dim(event.sandboxId)));
          break;
        case "setup_completed": {
          const steps = event.steps.map(
            (step) =>
              `${step.status === "ok" ? style.ok(SYMBOLS.ok) : style.fail(SYMBOLS.fail)} ${labelled(step)}`,
          );
          const checks = event.checks.map((check) =>
            [labelled(check), checkBefore(style, check.status)]
              .filter(Boolean)
              .join(" "),
          );
          write(line(style, `steps: ${steps.join("   ") || "none"}`));
          write(
            line(
              style,
              `checks before: ${checks.join(` ${SYMBOLS.dot} `) || "none"}`,
            ),
          );
          break;
        }
        case "tool_start": {
          const name = `${SYMBOLS.tool} ${event.toolName}`.padEnd(
            TOOL_NAME_WIDTH,
          );
          const input = describeToolInput(event.input);
          write(
            line(style, `${style.accent(name)} ${style.dim(input)}`.trimEnd()),
          );
          break;
        }
        case "tool_end": {
          const output = String(event.output ?? "");
          if (output.startsWith("Error:")) {
            write(
              line(
                style,
                `  ${style.fail(SYMBOLS.fail)} ${oneLine(output, 140)}`,
              ),
            );
          } else if (
            event.toolName === "run_checks" ||
            event.toolName === "try_environment"
          ) {
            for (const result of output.split("\n")) {
              if (/^[✓✗⚠] /.test(result))
                write(line(style, `  ${markLine(style, result)}`));
            }
          }
          break;
        }
      }
    },
    flush: flushText,
  };
}
