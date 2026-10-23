import type { OnboardingEvent, OnboardingEventBody } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";

const ts = "2026-10-23T10:00:00.000Z";

type Body = OnboardingEventBody extends infer T
  ? T extends unknown
    ? Omit<T, "ts">
    : never
  : never;

function numbered(...bodies: Body[]): OnboardingEvent[] {
  return bodies.map(
    (body, index) =>
      ({ ...body, ts, onboardingId: "s1", seq: index + 1 }) as OnboardingEvent,
  );
}

const question = {
  questionId: "q-1",
  question: "Backend tests need PostgreSQL. What should I do?",
  why: "They connect to localhost:5432.",
  options: [{ label: "Skip them" }, { label: "Keep them" }],
  allowOther: true,
};

const tried = (
  phase: "first" | "agent" | "final",
  status: "passing" | "failing",
) => ({
  type: "setup_completed" as const,
  phase,
  success: true,
  steps: [
    {
      name: "install",
      cwd: ".",
      command: "pnpm install",
      status: "ok" as const,
    },
  ],
  checks: [
    {
      name: "lint",
      cwd: "frontend",
      command: "pnpm lint",
      status: "passing" as const,
    },
    { name: "test", cwd: "backend", command: "pnpm test", status },
  ],
});

describe("buildTimeline", () => {
  it("turns setup's events into lines, in order", () => {
    const timeline = buildTimeline(
      numbered(
        { type: "info", message: "Preparing a sandbox…" },
        {
          type: "setup_drafted",
          projects: [
            { cwd: "frontend", packageManager: "pnpm" },
            { cwd: "backend", packageManager: "pnpm" },
          ],
        },
        {
          type: "info",
          message: "Installing dependencies and running checks…",
        },
        tried("first", "failing"),
        {
          type: "info",
          message:
            'Found a problem; starting the setup agent:\n  - Check "test" (backend) is failing.',
        },
        {
          type: "tool_start",
          toolCallId: "t1",
          toolName: "read_file",
          input: { path: "backend/test/setup.ts" },
        },
        { type: "tool_end", toolCallId: "t1", toolName: "read_file" },
        {
          type: "tool_start",
          toolCallId: "t2",
          toolName: "bash",
          input: { command: "pnpm --filter backend test" },
        },
        { type: "tool_end", toolCallId: "t2", toolName: "bash" },
        {
          type: "tool_start",
          toolCallId: "t3",
          toolName: "try_environment",
          input: {},
        },
        tried("agent", "passing"),
        { type: "info", message: "Final check in a fresh sandbox…" },
        tried("final", "passing"),
        { type: "info", message: "Environment\n  steps: …\n  checks: …" },
        { type: "done", status: "succeeded", version: 1 },
      ),
    );

    expect(timeline.lines.map((line) => line.kind)).toEqual([
      "info",
      "projects",
      "info",
      "tried",
      "problems",
      "agent",
      "tried",
      "info",
      "tried",
      "done",
    ]);
    expect(timeline.lines[0]).toEqual({
      kind: "info",
      seq: 1,
      text: "Preparing a sandbox",
    });
    expect(timeline.lines[4]).toMatchObject({
      items: ['Check "test" (backend) is failing.'],
    });
    expect(timeline.lines[5]).toMatchObject({
      actions: [
        { id: "t1", tool: "read_file", target: "backend/test/setup.ts" },
        { id: "t2", tool: "bash", target: "pnpm --filter backend test" },
      ],
    });
    expect(timeline.lines[8]).toMatchObject({ kind: "tried", phase: "final" });
    expect(timeline.lines.at(-1)).toEqual({
      kind: "done",
      seq: 15,
      status: "succeeded",
      version: 1,
      error: null,
    });
    expect(timeline.done).toBe(true);
    expect(timeline.latest).toEqual([
      "Final check in a fresh sandbox",
      "Final check: 2 of 2 checks passing",
      "Saved",
    ]);
  });

  it("keeps a question open until it's answered", () => {
    const asked = numbered(
      { type: "info", message: "Preparing a sandbox…" },
      { type: "question_asked", ...question },
    );
    const waiting = buildTimeline(asked);
    expect(waiting.openQuestion).toEqual({
      id: "q-1",
      question: question.question,
      why: question.why,
      options: question.options,
      allowOther: true,
    });
    expect(waiting.latest.at(-1)).toBe(`Asked: ${question.question}`);

    const answered = buildTimeline([
      ...asked,
      ...numbered({
        type: "question_answered",
        questionId: "q-1",
        answer: { option: 0 },
        label: "Skip them",
      }).map((e) => ({ ...e, seq: 3 })),
    ]);
    expect(answered.openQuestion).toBeNull();
    expect(answered.lines.at(-1)).toMatchObject({
      kind: "question",
      answer: "Skip them",
    });
    expect(answered.latest.at(-1)).toBe("Answered: Skip them");
  });

  it("says why setup ended without saving", () => {
    const timeline = buildTimeline(
      numbered(
        { type: "question_asked", ...question },
        {
          type: "done",
          status: "failed",
          error: "Setup stopped after waiting 30 minutes for an answer.",
        },
      ),
    );

    expect(timeline.openQuestion).toBeNull();
    expect(timeline.lines.at(-1)).toMatchObject({
      kind: "done",
      status: "failed",
      error: "Setup stopped after waiting 30 minutes for an answer.",
    });
    expect(timeline.latest.at(-1)).toBe("Setup didn't finish");
  });

  it("is empty before anything happened", () => {
    expect(buildTimeline([])).toEqual({
      lines: [],
      openQuestion: null,
      latest: [],
      done: false,
    });
  });
});
