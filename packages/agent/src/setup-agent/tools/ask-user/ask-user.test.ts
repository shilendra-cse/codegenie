import type { SetupAnswer, SetupQuestion } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import type { SetupToolContext } from "../../context.js";
import { askUser, MAX_QUESTIONS } from "./ask-user.js";

function context(answer: SetupAnswer) {
  const asked: SetupQuestion[] = [];
  const ctx: SetupToolContext = {
    tryEnvironment: async () => ({ steps: [], checks: [] }),
    channel: {
      ask: async (question) => {
        asked.push(question);
        return answer;
      },
      info: () => {},
    },
    questionsAsked: 0,
    decisions: [],
  };
  return { ctx, asked };
}

const question = {
  question: "Backend tests need PostgreSQL. What should I do?",
  options: [
    { label: "Run only the unit tests", detail: "npm run test:unit" },
    { label: "Skip backend tests" },
  ],
};

describe("ask_user", () => {
  it("passes the question on and records the chosen option", async () => {
    const { ctx, asked } = context({ option: 0 });
    expect(await askUser(ctx, question)).toBe(
      "The user chose: Run only the unit tests (npm run test:unit)",
    );
    expect(asked).toEqual([question]);
    expect(ctx.decisions).toEqual([
      {
        question: question.question,
        answer: "Run only the unit tests",
        auto: false,
      },
    ]);
  });

  it("records free-text answers", async () => {
    const { ctx } = context({ other: "Use npm run test:ci" });
    expect(await askUser(ctx, question)).toBe(
      "The user answered in their own words: Use npm run test:ci",
    );
    expect(ctx.decisions[0]!.answer).toBe("Use npm run test:ci");
  });

  it("marks options picked without a user as automatic", async () => {
    const { ctx } = context({ option: 0, auto: true });
    expect(await askUser(ctx, question)).toMatch(/^No one is available/);
    expect(ctx.decisions[0]!.auto).toBe(true);
  });

  it(`refuses more than ${MAX_QUESTIONS} questions`, async () => {
    const { ctx, asked } = context({ option: 1 });
    ctx.questionsAsked = MAX_QUESTIONS;
    await expect(askUser(ctx, question)).rejects.toThrow(/already asked 5/);
    expect(asked).toEqual([]);
  });

  it("rejects questions with fewer than two options", async () => {
    const { ctx } = context({ option: 0 });
    await expect(
      askUser(ctx, { question: "Ok?", options: [{ label: "Yes" }] }),
    ).rejects.toThrow();
  });
});
