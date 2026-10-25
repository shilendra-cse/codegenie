import type { DeliverableRun } from "@hobai/runner";
import { PRODUCT_NAME } from "@hobai/shared/brand";

const MAX_SUBJECT = 72;
const MAX_SUMMARY = 20_000;
const MAX_FILES_LISTED = 50;

const COMPARISON: Record<string, string> = {
  passing: "✅ passing",
  fixed: "✅ fixed",
  failing: "❌ failing",
  regressed: "❌ broken by this change",
  "still-failing": "⚠️ failing, as before this change",
};

export function isDraft(run: DeliverableRun) {
  return run.verify.passed === false || run.agent.status === "incomplete";
}

export function commitMessage(title: string, summary: string | null) {
  const line = title.split("\n")[0]!.trim();
  const subject =
    line.length > MAX_SUBJECT ? `${line.slice(0, MAX_SUBJECT - 1)}…` : line;
  return summary ? `${subject}\n\n${summary.trim()}` : subject;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}\n\n…(shortened)` : text;
}

export function pullRequestBody(
  run: DeliverableRun,
  options: { draftUnavailable?: boolean; taskUrl?: string } = {},
) {
  const sections: string[] = [];
  if (run.agent.status === "incomplete") {
    sections.push(
      `> **Incomplete:** the agent stopped at its ${run.agent.limitReached ?? "run"} limit before finishing. Review what's here before merging.`,
    );
  }
  if (options.draftUnavailable) {
    sections.push(
      "> **Not ready to merge:** this would be a draft, but draft pull requests aren't available on this repository.",
    );
  }
  sections.push(
    run.agent.summary
      ? truncate(run.agent.summary.trim(), MAX_SUMMARY)
      : "_The agent didn't leave a summary._",
  );

  const checks = run.verify.checks;
  sections.push(
    checks.length
      ? [
          "### Checks",
          "",
          "| Check | Command | Result |",
          "|---|---|---|",
          ...checks.map(
            (c) =>
              `| ${c.name}${c.cwd === "." ? "" : ` (\`${c.cwd}\`)`} | \`${c.command}\` | ${COMPARISON[c.comparison] ?? c.status} |`,
          ),
        ].join("\n")
      : "### Checks\n\nNo checks are set up for this repository.",
  );

  const files = run.diff.files;
  const listed = files.slice(0, MAX_FILES_LISTED).map((f) => {
    const counts =
      f.added === null ? "binary" : `+${f.added} −${f.removed ?? 0}`;
    return `- \`${f.path}\` (${counts})`;
  });
  if (files.length > MAX_FILES_LISTED) {
    listed.push(`- …and ${files.length - MAX_FILES_LISTED} more`);
  }
  sections.push(["### Changed files", "", ...listed].join("\n"));

  sections.push(
    options.taskUrl
      ? `<sub>Opened by ${PRODUCT_NAME} · [View the task](${options.taskUrl})</sub>`
      : `<sub>Opened by ${PRODUCT_NAME}.</sub>`,
  );
  return sections.join("\n\n");
}
