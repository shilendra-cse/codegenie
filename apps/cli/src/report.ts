import type { JobResult, JobStatus } from "@codegenie/runner";
import type { JobEvent } from "@codegenie/shared";

type Write = (line: string) => void;

const STAGE_LABEL: Record<string, string> = {
  prepare: "sandbox",
  checkout: "checkout",
  setup: "setup",
  agent: "agent",
  verify: "verify",
};

function oneLine(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function describeToolInput(input: unknown) {
  const args = (input ?? {}) as Record<string, unknown>;
  for (const key of ["path", "pattern", "command"]) {
    if (typeof args[key] === "string") return oneLine(args[key] as string, 100);
  }
  return "";
}

export function createLiveReporter(write: Write) {
  let text = "";
  const flushText = () => {
    if (text.trim()) write(`    💬 ${oneLine(text)}`);
    text = "";
  };

  return {
    onEvent(event: JobEvent) {
      if (event.type === "text_delta") {
        text += event.delta;
        return;
      }
      flushText();
      switch (event.type) {
        case "stage_changed":
          write(`→ ${STAGE_LABEL[event.stage] ?? event.stage}`);
          break;
        case "sandbox_created":
          write(`    ${event.sandboxId}`);
          break;
        case "setup_completed": {
          const checks = Object.keys(event.commands).filter(
            (k) => k !== "install",
          );
          write(
            `    install ${event.success ? "ok" : "FAILED"} · checks: ${checks.join(", ") || "none"}`,
          );
          break;
        }
        case "tool_start":
          write(
            `    ▶ ${event.toolName} ${describeToolInput(event.input)}`.trimEnd(),
          );
          break;
        case "tool_end": {
          const output = String(event.output ?? "");
          if (output.startsWith("Error:")) {
            write(`      ✗ ${oneLine(output, 140)}`);
          } else if (event.toolName === "run_checks") {
            for (const line of output.split("\n")) {
              if (/^[✓✗] /.test(line)) write(`      ${line}`);
            }
          }
          break;
        }
      }
    },
    flush: flushText,
  };
}

function seconds(ms: number) {
  return ms < 60_000
    ? `${Math.round(ms / 1000)}s`
    : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function tokens(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

export function formatSummary(
  result: JobResult,
  options: { patchPath?: string } = {},
): string {
  const lines: string[] = [""];
  const icon =
    result.status === "succeeded"
      ? "✓"
      : result.status === "incomplete"
        ? "◐"
        : "✗";
  const agent = result.agent;
  const stats = [`in ${seconds(result.durationMs)}`];
  if (agent) {
    const { inputTokens, cachedInputTokens, outputTokens, costUsd } =
      agent.usage;
    const cached = inputTokens
      ? Math.round((cachedInputTokens / inputTokens) * 100)
      : 0;
    stats.push(
      `${agent.steps} steps`,
      `${tokens(inputTokens + outputTokens)} tokens (${cached}% cached)`,
      `$${costUsd.toFixed(4)}`,
    );
  }
  lines.push(`${icon} ${result.status} ${stats.join(" · ")}`);

  if (result.failedStage)
    lines.push(`Failed at ${result.failedStage}: ${result.error}`);
  if (agent?.limitReached)
    lines.push(`Stopped at the ${agent.limitReached} limit.`);
  if (agent?.error) lines.push(`Agent: ${agent.error}`);
  if (agent?.summary) lines.push("", `Summary: ${agent.summary}`);

  for (const note of result.setup?.notes ?? []) lines.push(`Note: ${note}`);

  if (result.verify?.length) {
    lines.push(
      "",
      `Checks after the agent: ${result.verify.map((c) => `${c.name} ${c.passed ? "✓" : "✗"}`).join("  ")}`,
    );
    for (const check of result.verify.filter((c) => !c.passed)) {
      lines.push(
        `--- ${check.name} (${check.command}) ---`,
        check.outputTail ?? "",
      );
    }
  }

  const diff = result.diff;
  if (diff) {
    const added = diff.files.reduce((sum, f) => sum + (f.added ?? 0), 0);
    const removed = diff.files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
    lines.push(
      "",
      diff.files.length
        ? `Diff: ${diff.files.length} file${diff.files.length === 1 ? "" : "s"} changed (+${added} −${removed})`
        : "Diff: no changes",
    );
    for (const file of diff.files) {
      lines.push(
        `  ${file.path}  ${file.added === null ? "binary" : `+${file.added} −${file.removed}`}`,
      );
    }
    if (options.patchPath) {
      lines.push(`Patch saved to ${options.patchPath}`);
    } else if (diff.patch) {
      lines.push("", diff.patch.trimEnd());
      if (diff.truncated)
        lines.push("(patch truncated; use --patch to save it)");
    }
  }

  return lines.join("\n");
}

export function exitCode(status: JobStatus) {
  switch (status) {
    case "succeeded":
      return 0;
    case "incomplete":
      return 2;
    case "cancelled":
      return 130;
    case "failed":
      return 1;
  }
}
