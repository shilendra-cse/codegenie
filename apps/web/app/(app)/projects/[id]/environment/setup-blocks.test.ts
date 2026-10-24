import type { TimelineLine } from "@/features/setup/timeline";
import { describe, expect, it } from "vitest";
import { toSetupBlocks } from "./setup-blocks";

const at = (seq: number, seconds: number) => ({
  seq,
  ts: new Date(Date.UTC(2026, 9, 24, 10, 0, seconds)).toISOString(),
});
const start = Date.UTC(2026, 9, 24, 10, 0, 0);

const question = {
  id: "q-1",
  question: "Which tests?",
  options: [{ label: "Skip them" }],
  allowOther: true,
};

const lines: TimelineLine[] = [
  { ...at(1, 0), kind: "info", text: "Preparing a sandbox", progress: true },
  {
    ...at(2, 10),
    kind: "projects",
    projects: [{ cwd: ".", packageManager: "npm" }],
  },
  {
    ...at(3, 11),
    kind: "tried",
    phase: "first",
    steps: [{ name: "install", cwd: ".", command: "npm ci", status: "ok" }],
    checks: [{ name: "test", cwd: ".", status: "failing" }],
  },
  {
    ...at(4, 40),
    kind: "agent",
    actions: [{ id: "t1", tool: "read_file", target: "a.ts" }],
  },
  { ...at(5, 50), kind: "question", question, answer: null },
];

describe("toSetupBlocks", () => {
  it("splits the timeline around questions, with durations and states", () => {
    const blocks = toSetupBlocks(lines, { active: true, now: start + 70_000 });

    expect(blocks.map((b) => b.kind)).toEqual(["lines", "question"]);
    const [card, asked] = blocks;
    expect(card).toMatchObject({ kind: "lines", live: false });
    expect(
      card?.kind === "lines" &&
        card.lines.map((l) => [l.kind, l.state, l.durationMs]),
    ).toEqual([
      ["projects", "done", 10_000],
      ["tried", "warn", 1_000],
      ["agent", "done", 10_000],
    ]);
    expect(asked).toMatchObject({ number: 1, state: "open", answer: null });
  });

  it("shows what's happening now as running, with a live duration and the beam", () => {
    const working = lines.slice(0, 4);
    const [card] = toSetupBlocks(working, {
      active: true,
      now: start + 45_000,
    });

    expect(card).toMatchObject({ kind: "lines", live: true });
    expect(card?.kind === "lines" && card.lines.at(-1)).toMatchObject({
      kind: "agent",
      state: "running",
      durationMs: 5_000,
    });
  });

  it("shows a progress message only while it's the current activity", () => {
    const first = lines.slice(0, 1);
    expect(
      toSetupBlocks(first, { active: true, now: start + 2_000 }),
    ).toMatchObject([
      {
        kind: "lines",
        lines: [
          { kind: "text", state: "running", text: "Preparing a sandbox" },
        ],
      },
    ]);
    expect(toSetupBlocks(first, { active: false, now: start + 2_000 })).toEqual(
      [],
    );
  });

  it("shows the agent's try as running, then credits its time to the result", () => {
    const trying: TimelineLine = {
      ...at(5, 50),
      kind: "info",
      text: "Trying the new setup",
      progress: true,
    };
    const [running] = toSetupBlocks([...lines.slice(0, 4), trying], {
      active: true,
      now: start + 58_000,
    });
    expect(running?.kind === "lines" && running.lines.at(-1)).toMatchObject({
      kind: "text",
      state: "running",
      durationMs: 8_000,
    });

    const result: TimelineLine = {
      ...at(6, 80),
      kind: "tried",
      phase: "agent",
      steps: [{ name: "install", cwd: ".", command: "npm ci", status: "ok" }],
      checks: [{ name: "test", cwd: ".", status: "passing" }],
    };
    const [settled] = toSetupBlocks([...lines.slice(0, 4), trying, result], {
      active: true,
      now: start + 81_000,
    });
    expect(
      settled?.kind === "lines" &&
        settled.lines.map((l) => [l.kind, l.durationMs]),
    ).toEqual([
      ["projects", 10_000],
      ["tried", 1_000],
      ["agent", 10_000],
      ["tried", 30_000],
    ]);
  });

  it("marks a question answered, or unanswered once setup has ended", () => {
    const answered = [
      ...lines.slice(0, 4),
      {
        ...lines[4]!,
        kind: "question" as const,
        question,
        answer: "Skip them",
      },
    ];
    expect(
      toSetupBlocks(answered, { active: true, now: start }),
    ).toContainEqual(
      expect.objectContaining({
        kind: "question",
        state: "answered",
        answer: "Skip them",
      }),
    );
    expect(toSetupBlocks(lines, { active: false, now: start })).toContainEqual(
      expect.objectContaining({ kind: "question", state: "unanswered" }),
    );
  });

  it("marks an attempt whose install failed", () => {
    const [card] = toSetupBlocks(
      [
        {
          ...at(1, 0),
          kind: "tried",
          phase: "first",
          steps: [
            { name: "install", cwd: ".", command: "npm ci", status: "failed" },
          ],
          checks: [],
        },
      ],
      { active: false, now: start },
    );
    expect(card?.kind === "lines" && card.lines[0]).toMatchObject({
      state: "failed",
      installed: false,
    });
  });
});
