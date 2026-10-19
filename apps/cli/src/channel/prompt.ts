import { isCancel, select, text } from "@clack/prompts";
import type {
  SetupAnswer,
  SetupQuestion,
  UserChannel,
} from "@codegenie/shared";
import { InputClosedError } from "./terminal.js";

const OTHER = -1;

export function selectOptions(question: SetupQuestion) {
  const options = question.options.map((option, index) => ({
    value: index,
    label: index === 0 ? `${option.label} (recommended)` : option.label,
    ...(option.detail ? { hint: option.detail } : {}),
  }));
  return question.allowOther === false
    ? options
    : [...options, { value: OTHER, label: "Something else…" }];
}

/**
 * Questions answered with the arrow keys, for a real terminal. Live output is
 * paused while a question is open, so the spinner doesn't draw over it.
 */
export function promptChannel(live: {
  pause(): void;
  resume(): void;
  info(message: string): void;
}): UserChannel & { close(): void } {
  return {
    async ask(question: SetupQuestion): Promise<SetupAnswer> {
      live.pause();
      try {
        const choice = await select<number>({
          message: question.why
            ? `${question.question}\n${question.why}`
            : question.question,
          options: selectOptions(question),
          initialValue: 0,
        });
        if (isCancel(choice)) throw new InputClosedError();
        if (choice !== OTHER) return { option: choice };

        const answer = await text({
          message: "Your answer",
          validate: (value) =>
            value?.trim()
              ? undefined
              : "Type an answer, or press Ctrl+C to stop.",
        });
        if (isCancel(answer)) throw new InputClosedError();
        return { other: answer.trim() };
      } finally {
        live.resume();
      }
    },
    info: (message) => live.info(message),
    close: () => {},
  };
}
