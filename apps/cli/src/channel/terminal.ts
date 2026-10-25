import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { SetupAnswer, SetupQuestion, UserChannel } from "@hobai/shared";

export class InputClosedError extends Error {
  constructor() {
    super("No answer: the input was closed.");
  }
}

/** Asks questions in the terminal: numbered options, plus "Something else…" unless turned off. */
export function terminalChannel(
  input: Readable,
  output: Writable,
): UserChannel & { close(): void } {
  const rl = createInterface({ input, output, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const write = (text: string) => output.write(`${text}\n`);

  async function readLine(prompt: string) {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new InputClosedError();
    return next.value.trim();
  }

  return {
    async ask(question: SetupQuestion): Promise<SetupAnswer> {
      write(`\n? ${question.question}`);
      if (question.why) write(`  ${question.why}`);
      question.options.forEach((option, index) => {
        write(
          `  ${index + 1}. ${option.label}${index === 0 ? " (recommended)" : ""}`,
        );
        if (option.detail) write(`     ${option.detail}`);
      });
      const other =
        question.allowOther === false ? null : question.options.length + 1;
      if (other) write(`  ${other}. Something else…`);
      const last = other ?? question.options.length;

      while (true) {
        const choice = Number(await readLine("› "));
        if (Number.isInteger(choice) && choice >= 1 && choice <= last) {
          if (choice !== other) return { option: choice - 1 };
          const text = await readLine("  Your answer: ");
          if (text) return { other: text };
        }
        write(`  Type a number from 1 to ${last}.`);
      }
    },
    info: write,
    close: () => rl.close(),
  };
}
