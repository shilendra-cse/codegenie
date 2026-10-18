import { PassThrough } from "node:stream";
import type { SetupQuestion } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { InputClosedError, terminalChannel } from "./terminal.js";

function terminal(...answers: string[]) {
  const input = new PassThrough();
  const output = new PassThrough();
  let printed = "";
  output.on("data", (chunk: Buffer) => (printed += chunk.toString()));
  input.end(answers.map((a) => `${a}\n`).join(""));
  return { channel: terminalChannel(input, output), printed: () => printed };
}

const question: SetupQuestion = {
  question: "Backend tests need PostgreSQL. What should I do?",
  why: "9 tests fail with ECONNREFUSED.",
  options: [
    { label: "Run only the unit tests", detail: "npm run test:unit" },
    { label: "Skip backend tests" },
  ],
};

describe("terminalChannel", () => {
  it("shows numbered options with the recommended one first, and returns the choice", async () => {
    const { channel, printed } = terminal("2");
    expect(await channel.ask(question)).toEqual({ option: 1 });
    expect(printed()).toBe(
      [
        "",
        "? Backend tests need PostgreSQL. What should I do?",
        "  9 tests fail with ECONNREFUSED.",
        "  1. Run only the unit tests (recommended)",
        "     npm run test:unit",
        "  2. Skip backend tests",
        "  3. Something else…",
        "› ",
      ].join("\n"),
    );
  });

  it("asks again until it gets a valid number", async () => {
    const { channel, printed } = terminal("", "7", "one", "1");
    expect(await channel.ask(question)).toEqual({ option: 0 });
    expect(printed().match(/Type a number from 1 to 3\./g)).toHaveLength(3);
  });

  it("takes an answer in the user's own words", async () => {
    const { channel } = terminal("3", "Use npm run test:ci");
    expect(await channel.ask(question)).toEqual({
      other: "Use npm run test:ci",
    });
  });

  it("offers only the listed options when other answers make no sense", async () => {
    const { channel, printed } = terminal("3", "2");
    const answer = await channel.ask({
      question: "Save this environment?",
      options: [{ label: "Save" }, { label: "Discard" }],
      allowOther: false,
    });
    expect(answer).toEqual({ option: 1 });
    expect(printed()).not.toContain("Something else");
    expect(printed()).toContain("Type a number from 1 to 2.");
  });

  it("fails when the input ends without an answer", async () => {
    const { channel } = terminal();
    await expect(channel.ask(question)).rejects.toThrow(InputClosedError);
  });
});
