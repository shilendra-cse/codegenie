import type {
  CheckComparison,
  OnboardingResult,
  RunResult,
} from "@codegenie/runner";
import type { FinalRunStatus, OnboardingStatus } from "@codegenie/shared";
import {
  cost,
  duration,
  line,
  outro,
  plural,
  section,
  type Style,
} from "@codegenie/terminal";

const labelled = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? item.name : `${item.name} (${item.cwd})`;

function comparison(style: Style, value: CheckComparison) {
  switch (value) {
    case "passing":
      return style.ok("✓");
    case "fixed":
      return style.ok("✓ fixed");
    case "failing":
      return style.fail("✗");
    case "regressed":
      return style.fail("✗ regressed");
    case "still-failing":
      return style.warn("✗ still failing");
  }
}

function statusMark(style: Style, status: FinalRunStatus) {
  switch (status) {
    case "succeeded":
      return style.ok(`✓ ${status}`);
    case "incomplete":
      return style.warn(`◐ ${status}`);
    default:
      return style.fail(`✗ ${status}`);
  }
}

function tokens(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

export function formatSummary(
  result: RunResult,
  options: { style: Style; patchPath?: string },
): string {
  const { style } = options;
  const lines = ["", section(style, "Result")];
  const add = (text = "") => lines.push(line(style, text));
  const agent = result.agent;

  if (agent?.summary) add(agent.summary);
  if (result.failedStage) {
    add(style.fail(`Failed at ${result.failedStage}: ${result.error}`));
  }
  if (agent?.limitReached)
    add(style.warn(`Stopped at the ${agent.limitReached} limit.`));
  if (agent?.error) add(style.fail(`Agent: ${agent.error}`));
  for (const note of result.setup?.notes ?? [])
    add(`${style.dim("Note:")} ${note}`);
  if (result.setup?.health === "needs_attention") {
    add(style.warn("⚠ The environment needs attention:"));
    for (const reason of result.setup.healthReasons)
      add(style.warn(`  - ${reason}`));
    add(style.dim("  Run pnpm agent:setup again to update it."));
  }

  const verified = result.verify?.checks ?? [];
  if (verified.length) {
    add();
    add(
      `Checks: ${verified.map((c) => `${labelled(c)} ${comparison(style, c.comparison)}`).join("  ")}`,
    );
    for (const check of verified.filter(
      (c) => c.comparison === "regressed" || c.comparison === "failing",
    )) {
      add(style.dim(`--- ${labelled(check)} (${check.command}) ---`));
      for (const output of (check.outputTail ?? "").split("\n"))
        add(style.dim(output));
    }
  }

  const diff = result.diff;
  if (diff) {
    const added = diff.files.reduce((sum, f) => sum + (f.added ?? 0), 0);
    const removed = diff.files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
    add();
    add(
      diff.files.length
        ? `${plural(diff.files.length, "file")} changed (${style.ok(`+${added}`)} ${style.fail(`−${removed}`)})`
        : "No changes",
    );
    for (const file of diff.files) {
      add(
        `  ${file.path}  ${style.dim(file.added === null ? "binary" : `+${file.added} −${file.removed}`)}`,
      );
    }
    if (options.patchPath) add(`Patch saved to ${options.patchPath}`);
  }

  const stats = [statusMark(style, result.status)];
  if (agent) {
    const { inputTokens, cachedInputTokens, outputTokens, costUsd } =
      agent.usage;
    const cached = inputTokens
      ? Math.round((cachedInputTokens / inputTokens) * 100)
      : 0;
    stats.push(
      plural(agent.steps, "step"),
      `${tokens(inputTokens + outputTokens)} tokens (${cached}% cached)`,
      cost(costUsd),
    );
  }
  stats.push(duration(result.durationMs));
  lines.push(outro(style, stats.join(style.dim(" · "))));

  if (diff?.patch && !options.patchPath) {
    lines.push("", diff.patch.trimEnd());
    if (diff.truncated)
      lines.push(style.dim("(patch truncated; use --patch to save it)"));
  }
  return lines.join("\n");
}

export function exitCode(status: FinalRunStatus) {
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

function onboardingMark(style: Style, status: OnboardingStatus) {
  switch (status) {
    case "approved":
      return style.ok(`✓ ${status}`);
    case "discarded":
      return style.warn(`○ ${status}`);
    default:
      return style.fail(`✗ ${status}`);
  }
}

export type SavedSetup = {
  version: number;
  /** Where the store keeps it. */
  file: string;
  /** The extra copy asked for with --save. */
  copy?: string;
};

export function formatSetupSummary(
  result: OnboardingResult,
  saved: SavedSetup | null,
  style: Style,
): string {
  const lines = [line(style)];
  if (result.error)
    lines.push(line(style, style.fail(`Error: ${result.error}`)));
  if (result.agent?.error) {
    lines.push(line(style, style.fail(`Setup agent: ${result.agent.error}`)));
  }
  if (saved) {
    lines.push(
      line(
        style,
        `Saved as version ${saved.version} ${style.dim(`· ${saved.file}`)}`,
      ),
    );
    if (saved.copy) lines.push(line(style, `Copy written to ${saved.copy}`));
  }
  if (result.status === "discarded")
    lines.push(line(style, "Nothing was saved."));

  const stats = [onboardingMark(style, result.status)];
  if (result.agent) {
    stats.push(
      `setup agent: ${plural(result.agent.steps, "step")}`,
      cost(result.agent.usage.costUsd),
    );
  }
  stats.push(duration(result.durationMs));
  lines.push(outro(style, stats.join(style.dim(" · "))));
  return lines.join("\n");
}

export function setupExitCode(status: OnboardingStatus) {
  return status === "approved" || status === "discarded"
    ? 0
    : status === "cancelled"
      ? 130
      : 1;
}
