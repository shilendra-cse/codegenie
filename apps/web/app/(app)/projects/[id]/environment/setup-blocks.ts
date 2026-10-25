import type { OnboardingQuestion } from "@hobai/shared";
import type { SetupLineView } from "@/components/organisms/setup-timeline";
import type { TimelineLine } from "@/features/setup/timeline";

export type SetupBlock =
  | { kind: "lines"; key: string; lines: SetupLineView[]; live: boolean }
  | {
      kind: "question";
      key: string;
      number: number;
      question: OnboardingQuestion;
      state: "open" | "answered" | "unanswered";
      answer: string | null;
    };

type Shown = Exclude<TimelineLine, { kind: "question" | "done" }>;

function stateOf(line: Shown, runningNow: boolean): SetupLineView["state"] {
  if (runningNow) return "running";
  if (line.kind === "problems") return "warn";
  if (line.kind !== "tried") return "done";
  if (line.steps.some((step) => step.status !== "ok")) return "failed";
  return line.checks.every((check) => check.status === "passing")
    ? "done"
    : "warn";
}

function toView(
  line: Shown,
  state: SetupLineView["state"],
  durationMs: number | null,
): SetupLineView {
  const base = { key: String(line.seq), state, durationMs };
  switch (line.kind) {
    case "info":
      return { ...base, kind: "text", text: line.text };
    case "problems":
      return { ...base, kind: "problems", items: line.items };
    case "projects":
      return { ...base, kind: "projects", projects: line.projects };
    case "tried":
      return {
        ...base,
        kind: "tried",
        phase: line.phase,
        installCommand: line.steps[0]?.command ?? null,
        installed: line.steps.every((step) => step.status === "ok"),
        checks: line.checks,
      };
    case "agent":
      return { ...base, kind: "agent", actions: line.actions };
  }
}

/**
 * The page's blocks: timeline cards split by the questions asked between them. While setup runs,
 * the last line is what's happening now; "Installing…"-style lines only show while they're current.
 */
export function toSetupBlocks(
  lines: TimelineLine[],
  { active, now }: { active: boolean; now: number },
): SetupBlock[] {
  const blocks: SetupBlock[] = [];
  let card: Extract<SetupBlock, { kind: "lines" }> | null = null;
  let questions = 0;

  lines.forEach((line, index) => {
    const next = lines[index + 1];
    const isLast = !next;
    if (line.kind === "done") return;
    if (line.kind === "question") {
      card = null;
      questions += 1;
      blocks.push({
        kind: "question",
        key: line.question.id,
        number: questions,
        question: line.question,
        state: line.answer ? "answered" : active ? "open" : "unanswered",
        answer: line.answer,
      });
      return;
    }
    const current = active && isLast;
    if (line.kind === "info" && line.progress && !current) return;

    const started = Date.parse(line.ts);
    const previous = lines[index - 1];
    // Setup reports a result when the work is done, so a result took the time since the line before it;
    // the agent's work and what's happening now are timed from their own start.
    const timedFromStart =
      line.kind === "agent" || (line.kind === "info" && line.progress);
    const runningNow = current && timedFromStart;
    const durationMs = !timedFromStart
      ? previous
        ? started - Date.parse(previous.ts)
        : null
      : next
        ? Date.parse(next.ts) - started
        : current
          ? now - started
          : null;
    if (!card) {
      card = {
        kind: "lines",
        key: `lines-${line.seq}`,
        lines: [],
        live: false,
      };
      blocks.push(card);
    }
    card.lines.push(toView(line, stateOf(line, runningNow), durationMs));
  });

  const last = blocks.at(-1);
  if (active && last?.kind === "lines") last.live = true;
  return blocks;
}
