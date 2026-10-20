import path from "node:path";
import type { TaskResult } from "./run/run-eval-task.js";

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const SOLVED = (solved: boolean | null) =>
  solved === null ? "review" : solved ? "✓" : "✗";

function checksCell(checks: TaskResult["checks"]) {
  if (!checks) return "—";
  const parts = [];
  if (checks.fixed) parts.push(`${checks.fixed} fixed`);
  if (checks.regressions) parts.push(`${checks.regressions} regressed`);
  if (checks.failing) parts.push(`${checks.failing} failing`);
  return parts.length ? parts.join(", ") : "all passing";
}

export function formatReport(
  results: TaskResult[],
  run: {
    model: string;
    startedAt: Date;
    durationMs: number;
    resultsDir: string;
  },
): string {
  const label = (r: TaskResult) =>
    results.some((o) => o.id === r.id && o.attempt !== r.attempt)
      ? `${r.id} #${r.attempt}`
      : r.id;
  const lines = [
    `# Eval run · ${run.startedAt.toISOString().slice(0, 16).replace("T", " ")} · ${run.model}`,
    "",
    "| Task | Solved | Agent | Checks | Steps | Time | Cost |",
    "|---|---|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${label(r)} | ${SOLVED(r.solved)} | ${r.agent?.status ?? `${r.run.status} at ${r.run.failedStage ?? "?"}`} | ${checksCell(r.checks)} | ${r.agent?.steps ?? "—"} | ${duration(r.durationMs)} | ${r.agent ? `$${r.agent.costUsd.toFixed(4)}` : "—"} |`,
    ),
  ];

  const solved = results.filter((r) => r.solved === true).length;
  const review = results.filter((r) => r.solved === null).length;
  const cost = results.reduce((sum, r) => sum + (r.agent?.costUsd ?? 0), 0);
  lines.push(
    "",
    `**Solved ${solved} of ${results.length - review}**${review ? ` (${review} to review)` : ""} · $${cost.toFixed(4)} · ${duration(run.durationMs)}`,
  );

  const notSolved = results.filter((r) => r.solved !== true);
  if (notSolved.length) lines.push("", "## Not solved or to review");
  for (const r of notSolved) {
    lines.push("", `### ${label(r)}`, "", "```", r.grade.detail, "```");
    if (r.run.error) lines.push("", `Run error: ${r.run.error}`);
    if (r.agent?.summary) lines.push("", `Agent summary: ${r.agent.summary}`);
    if (r.diffFile) {
      lines.push("", `Diff: ${path.relative(run.resultsDir, r.diffFile)}`);
    }
  }
  return lines.join("\n");
}
