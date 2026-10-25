import type { RepoSource } from "@hobai/runner";
import type { StoredEnvironment } from "@hobai/shared";
import { intro, line, outro, type Style } from "@hobai/terminal";

const where = (item: { name: string; cwd: string }) =>
  item.cwd === "." ? item.name : `${item.name} (${item.cwd})`;

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

const repoArgument = (source: RepoSource) =>
  source.type === "git" ? source.url : source.path;

/** One line naming the version in use, for agent:run's header. */
export function versionLine(stored: StoredEnvironment) {
  return `version ${stored.version} · ${stored.source} · saved ${when(stored.savedAt)}`;
}

/** Shown when a task is given for a repository that hasn't been set up. */
export function missingEnvironment(
  style: Style,
  repoKey: string,
  source: RepoSource,
) {
  return [
    `${style.fail("✗")} No environment for ${repoKey} yet.`,
    `  Set the repository up first: pnpm agent:setup --repo ${repoArgument(source)}`,
  ].join("\n");
}

/** Lines warning that the active version needs attention, with the reasons. */
export function healthWarning(style: Style, stored: StoredEnvironment) {
  if (stored.health.status === "ok") return [];
  return [
    line(style, style.warn("⚠ The environment needs attention:")),
    ...stored.health.reasons.map((reason) =>
      line(style, style.warn(`  - ${reason}`)),
    ),
    line(style, style.dim("  Run pnpm agent:setup again to update it.")),
  ];
}

/** agent:setup --show. */
export function describeSaved(
  style: Style,
  repoKey: string,
  versions: StoredEnvironment[],
  file: string,
) {
  const [active, ...older] = versions;
  if (!active) return null;
  const { config, health } = active;
  const olderNote = older.length
    ? ` · ${older.length} older version${older.length === 1 ? "" : "s"}`
    : "";
  return [
    intro(style, repoKey),
    line(
      style,
      `Version ${active.version} (active) · ${active.source} · saved ${when(active.savedAt)}${olderNote}`,
    ),
    health.status === "ok"
      ? line(style, `Health: ${style.ok("✓ ok")}`)
      : line(
          style,
          `Health: ${style.warn("⚠ needs attention")}${health.at ? style.dim(` (since ${when(health.at)})`) : ""}`,
        ),
    ...health.reasons.map((reason) => line(style, style.warn(`  - ${reason}`))),
    line(
      style,
      `Steps:  ${config.steps.map((s) => `${where(s)}: ${s.command}`).join(" · ") || "none"}`,
    ),
    line(style, `Checks: ${config.checks.map(where).join(" · ") || "none"}`),
    ...(config.meta.decisions.length
      ? [
          line(style, "Answers:"),
          ...config.meta.decisions.map((d) =>
            line(
              style,
              `  - ${d.question} → ${d.answer}${d.auto ? style.dim(" (automatic)") : ""}`,
            ),
          ),
        ]
      : []),
    outro(style, style.dim(file)),
  ].join("\n");
}
