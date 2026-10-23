import { randomUUID } from "node:crypto";
import type {
  OnboardingAnswer,
  OnboardingEventBody,
  RunEvent,
  SetupQuestion,
  UserChannel,
} from "@codegenie/shared";
import type { EventSink } from "../events/sink.js";
import type { OnboardingRecord } from "./onboarding-record.js";

export type EventChannelOptions = {
  sink: EventSink<RunEvent | OnboardingEventBody>;
  record: Pick<OnboardingRecord, "waiting" | "resumed">;
  signal: AbortSignal;
  /** How long a question waits for its answer. */
  timeoutMs: number;
  /** Called when a question went unanswered; the caller stops setup. */
  onTimeout: () => void;
};

/** Asks through stored events; answers come back through `receive`. */
export type EventChannel = UserChannel & {
  receive(questionId: string, answer: OnboardingAnswer): void;
};

function isValid(question: SetupQuestion, answer: OnboardingAnswer) {
  if ("option" in answer) {
    return (
      Number.isInteger(answer.option) &&
      answer.option >= 0 &&
      answer.option < question.options.length
    );
  }
  return (question.allowOther ?? true) && answer.other.trim().length > 0;
}

function labelOf(question: SetupQuestion, answer: OnboardingAnswer) {
  return "option" in answer
    ? question.options[answer.option]!.label
    : answer.other.trim();
}

export function createEventChannel(options: EventChannelOptions): EventChannel {
  const { sink, record, signal } = options;
  const now = () => new Date().toISOString();
  let open: {
    questionId: string;
    question: SetupQuestion;
    accept(answer: OnboardingAnswer): void;
  } | null = null;

  return {
    info: (message) => sink.emit({ type: "info", ts: now(), message }),

    async ask(question) {
      if (signal.aborted) throw new Error("Setup was stopped.");
      const questionId = randomUUID();
      sink.emit({
        type: "question_asked",
        ts: now(),
        questionId,
        question: question.question,
        ...(question.why ? { why: question.why } : {}),
        options: question.options,
        allowOther: question.allowOther ?? true,
      });
      await record.waiting(questionId);

      const answer = await new Promise<OnboardingAnswer>((resolve, reject) => {
        const settle = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", stopped);
          open = null;
        };
        const stopped = () => {
          settle();
          reject(new Error("Setup was stopped."));
        };
        const timer = setTimeout(() => {
          settle();
          // Setup is stopped first, so the agent ends instead of carrying on without an answer.
          options.onTimeout();
          reject(new Error("No answer came in time."));
        }, options.timeoutMs);
        signal.addEventListener("abort", stopped, { once: true });
        open = {
          questionId,
          question,
          accept: (given) => {
            settle();
            resolve(given);
          },
        };
      });

      sink.emit({
        type: "question_answered",
        ts: now(),
        questionId,
        answer,
        label: labelOf(question, answer),
      });
      await record.resumed();
      return answer;
    },

    receive(questionId, answer) {
      if (open?.questionId !== questionId) return;
      if (!isValid(open.question, answer)) return;
      open.accept(answer);
    },
  };
}
