import { tool } from "ai";
import { z } from "zod";
import { runTool } from "../../../tools/core/run-tool.js";
import { ToolError } from "../../../tools/core/tool-error.js";
import type { SetupToolContext } from "../../context.js";
import { askUserDescription } from "./description.js";

export const MAX_QUESTIONS = 5;

export const askUserInput = z.object({
  question: z.string().trim().min(1),
  why: z
    .string()
    .optional()
    .describe("What you found that led to the question, in one sentence"),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        detail: z
          .string()
          .optional()
          .describe("The exact change, e.g. the command that would be used"),
      }),
    )
    .min(2)
    .max(4),
});

export async function askUser(
  ctx: SetupToolContext,
  input: z.input<typeof askUserInput>,
) {
  const question = askUserInput.parse(input);
  if (ctx.questionsAsked >= MAX_QUESTIONS) {
    throw new ToolError(
      `You have already asked ${MAX_QUESTIONS} questions. Decide yourself, preferring the option you would recommend.`,
    );
  }
  ctx.questionsAsked += 1;

  const answer = await ctx.channel.ask(question);
  if ("other" in answer) {
    ctx.decisions.push({
      question: question.question,
      answer: answer.other,
      auto: false,
    });
    return `The user answered in their own words: ${answer.other}`;
  }

  const chosen = question.options[answer.option] ?? question.options[0]!;
  const auto = answer.auto ?? false;
  ctx.decisions.push({
    question: question.question,
    answer: chosen.label,
    auto,
  });
  const label = chosen.detail
    ? `${chosen.label} (${chosen.detail})`
    : chosen.label;
  return auto
    ? `No one is available to answer; the recommended option was chosen: ${label}`
    : `The user chose: ${label}`;
}

export const askUserTool = (ctx: SetupToolContext) =>
  tool({
    description: askUserDescription,
    inputSchema: askUserInput,
    execute: (input) => runTool(() => askUser(ctx, input)),
  });
