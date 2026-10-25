import type {
  OnboardingEndStatus,
  OnboardingEvent,
  OnboardingQuestion,
  PackageManager,
  RunEventSetupCompleted,
} from "@hobai/shared";

type Tried = Pick<RunEventSetupCompleted, "steps" | "checks">;

/** One thing the agent did while looking into a problem. */
export type AgentAction = { id: string; tool: string; target: string | null };

/** Every line has when it started (`ts`), so the page can show how long each took. */
export type TimelineLine = { seq: number; ts: string } & (
  | {
      kind: "info";
      text: string;
      /** "Installing…"-style messages: what's happening now, not a result. */
      progress: boolean;
    }
  | { kind: "problems"; items: string[] }
  | {
      kind: "projects";
      projects: { cwd: string; packageManager: PackageManager | null }[];
    }
  | ({ kind: "tried"; phase: "first" | "agent" | "final" } & Tried)
  | { kind: "agent"; actions: AgentAction[] }
  | { kind: "question"; question: OnboardingQuestion; answer: string | null }
  | {
      kind: "done";
      status: OnboardingEndStatus;
      version: number | null;
      error: string | null;
    }
);

export type Timeline = {
  lines: TimelineLine[];
  /** The question waiting for an answer, if any. */
  openQuestion: OnboardingQuestion | null;
  /** Short descriptions of the latest lines, newest last (Welcome's compact card). */
  latest: string[];
  done: boolean;
};

// The agent's own setup tools show up elsewhere: its tries as results, its questions as cards.
const SHOWN_ELSEWHERE = new Set([
  "try_environment",
  "ask_user",
  "finish_setup",
]);

function targetOf(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const fields = input as Record<string, unknown>;
  for (const key of ["path", "command", "pattern", "query"]) {
    if (typeof fields[key] === "string") return fields[key];
  }
  return null;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function describeLine(line: TimelineLine): string {
  switch (line.kind) {
    case "info":
      return line.text;
    case "problems":
      return `Found ${plural(line.items.length, "problem")}`;
    case "projects":
      return `Found ${plural(line.projects.length, "project")}`;
    case "tried": {
      const passing = line.checks.filter((c) => c.status === "passing").length;
      const checks = `${passing} of ${plural(line.checks.length, "check")} passing`;
      return line.phase === "final"
        ? `Final check: ${checks}`
        : `Installed and ran checks: ${checks}`;
    }
    case "agent":
      return `Looked into it · ${plural(line.actions.length, "step")}`;
    case "question":
      return line.answer
        ? `Answered: ${line.answer}`
        : `Asked: ${line.question.question}`;
    case "done":
      return line.status === "succeeded"
        ? "Saved"
        : line.status === "cancelled"
          ? "Stopped"
          : "Setup didn't finish";
  }
}

const progressLine = (
  at: { seq: number; ts: string },
  text: string,
): TimelineLine => ({ kind: "info", ...at, text, progress: true });

/** Turns a setup's events, in order, into what the page shows. */
export function buildTimeline(events: OnboardingEvent[]): Timeline {
  const lines: TimelineLine[] = [];
  const questions = new Map<
    string,
    Extract<TimelineLine, { kind: "question" }>
  >();
  let agent: Extract<TimelineLine, { kind: "agent" }> | null = null;

  for (const event of events) {
    const at = { seq: event.seq ?? 0, ts: event.ts };
    // Consecutive tool calls (and their ends) are one group of the agent's work.
    if (event.type !== "tool_start" && event.type !== "tool_end") agent = null;
    switch (event.type) {
      case "info": {
        const [first, ...rest] = event.message.split("\n");
        // The final summary is a block of text; the saved environment is shown from its own data instead.
        if (rest.length > 0 && first?.startsWith("Found")) {
          lines.push({
            kind: "problems",
            ...at,
            items: rest
              .map((item) => item.replace(/^\s*-\s*/, ""))
              .filter(Boolean),
          });
        } else if (rest.length === 0) {
          lines.push({
            kind: "info",
            ...at,
            text: event.message.replace(/…$/, ""),
            progress: event.message.endsWith("…"),
          });
        }
        break;
      }
      case "setup_drafted":
        lines.push({ kind: "projects", ...at, projects: event.projects });
        break;
      case "setup_completed":
        lines.push({
          kind: "tried",
          ...at,
          phase: event.phase ?? "first",
          steps: event.steps,
          checks: event.checks,
        });
        break;
      case "tool_start": {
        // Its result arrives as a "tried" line; until then, say what's happening.
        if (event.toolName === "try_environment") {
          agent = null;
          lines.push(progressLine(at, "Trying the new setup"));
          break;
        }
        if (SHOWN_ELSEWHERE.has(event.toolName)) break;
        const action = {
          id: event.toolCallId,
          tool: event.toolName,
          target: targetOf(event.input),
        };
        if (agent) {
          agent.actions.push(action);
        } else {
          agent = { kind: "agent", ...at, actions: [action] };
          lines.push(agent);
        }
        break;
      }
      case "question_asked": {
        const line = {
          kind: "question" as const,
          ...at,
          question: {
            id: event.questionId,
            question: event.question,
            ...(event.why ? { why: event.why } : {}),
            options: event.options,
            allowOther: event.allowOther,
          },
          answer: null,
        };
        questions.set(event.questionId, line);
        lines.push(line);
        break;
      }
      case "question_answered": {
        const asked = questions.get(event.questionId);
        if (asked) asked.answer = event.label;
        lines.push(progressLine(at, "Carrying on with your answer"));
        break;
      }
      case "done":
        lines.push({
          kind: "done",
          ...at,
          status: event.status,
          version: event.version ?? null,
          error: event.error ?? null,
        });
        break;
      default:
        break;
    }
  }

  const open = [...questions.values()].find((q) => q.answer === null);
  const done = lines.some((line) => line.kind === "done");
  return {
    lines,
    openQuestion: !done && open ? open.question : null,
    latest: lines.slice(-3).map(describeLine),
    done,
  };
}
