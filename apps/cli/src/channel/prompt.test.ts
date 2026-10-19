import { beforeEach, describe, expect, it, vi } from "vitest";

const answers: unknown[] = [];
const CANCEL = Symbol("cancel");
vi.mock("@clack/prompts", () => ({
  select: vi.fn(async () => answers.shift()),
  text: vi.fn(async () => answers.shift()),
  isCancel: (value: unknown) => value === CANCEL,
}));

import { select } from "@clack/prompts";
import { promptChannel, selectOptions } from "./prompt.js";
import { InputClosedError } from "./terminal.js";

const question = {
  question: "Backend tests need PostgreSQL. What should I do?",
  options: [
    { label: "Run only the unit tests", detail: "npm run test:unit" },
    { label: "Skip backend tests" },
  ],
};

function channel() {
  const calls: string[] = [];
  return {
    calls,
    channel: promptChannel({
      pause: () => calls.push("pause"),
      resume: () => calls.push("resume"),
      info: (message) => calls.push(`info:${message}`),
    }),
  };
}

describe("promptChannel", () => {
  beforeEach(() => {
    answers.length = 0;
    vi.clearAllMocks();
  });

  it("lists the options with the recommended one first, plus something else", () => {
    expect(selectOptions(question)).toEqual([
      {
        value: 0,
        label: "Run only the unit tests (recommended)",
        hint: "npm run test:unit",
      },
      { value: 1, label: "Skip backend tests" },
      { value: -1, label: "Something else…" },
    ]);
    expect(selectOptions({ ...question, allowOther: false })).toHaveLength(2);
  });

  it("returns the chosen option and pauses live output meanwhile", async () => {
    const { channel: c, calls } = channel();
    answers.push(1);
    expect(await c.ask(question)).toEqual({ option: 1 });
    expect(calls).toEqual(["pause", "resume"]);
    expect(vi.mocked(select).mock.calls[0]![0]).toMatchObject({
      initialValue: 0,
    });
  });

  it("asks for the user's own answer after something else", async () => {
    const { channel: c } = channel();
    answers.push(-1, "  Use npm run test:ci ");
    expect(await c.ask(question)).toEqual({ other: "Use npm run test:ci" });
  });

  it("stops when the user cancels, and still resumes live output", async () => {
    const { channel: c, calls } = channel();
    answers.push(CANCEL);
    await expect(c.ask(question)).rejects.toThrow(InputClosedError);
    expect(calls).toEqual(["pause", "resume"]);
  });
});
