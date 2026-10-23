import type { RunEvent, RunEventDone } from "./events.js";

/** What the browser sends: one of the options, or free text. */
export type OnboardingAnswer = { option: number } | { other: string };

export type OnboardingEndStatus = "succeeded" | "failed" | "cancelled";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** What a setup records: the runner's events (minus the run id) plus its own. */
export type OnboardingEventBody =
  | DistributiveOmit<Exclude<RunEvent, RunEventDone>, "runId" | "seq">
  | { type: "info"; ts: string; message: string }
  | {
      type: "question_asked";
      ts: string;
      questionId: string;
      question: string;
      why?: string;
      /** 2–4 options; the first one is recommended. */
      options: { label: string; detail?: string }[];
      allowOther: boolean;
    }
  | {
      type: "question_answered";
      ts: string;
      questionId: string;
      answer: OnboardingAnswer;
      /** The chosen option's label, or what was typed. */
      label: string;
    }
  | {
      type: "done";
      ts: string;
      status: OnboardingEndStatus;
      version?: number;
      error?: string;
    };

export type OnboardingEvent = OnboardingEventBody & {
  onboardingId: string;
  /** Absent for events that are streamed but not stored (text_delta). */
  seq?: number;
};

/** Published on ANSWER_CHANNEL for the worker running the setup. */
export type OnboardingAnswerMessage = {
  onboardingId: string;
  questionId: string;
  answer: OnboardingAnswer;
};
