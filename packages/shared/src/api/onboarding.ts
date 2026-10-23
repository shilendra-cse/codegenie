import { z } from "zod";
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

export const answerOnboardingSchema = z.object({
  questionId: z.string().min(1),
  answer: z.union([
    z.object({ option: z.number().int().min(0) }).strict(),
    z
      .object({
        other: z
          .string()
          .trim()
          .min(1, "Write an answer.")
          .max(2000, "Keep the answer under 2000 characters."),
      })
      .strict(),
  ]),
});

export type AnswerOnboardingInput = z.infer<typeof answerOnboardingSchema>;

export type OnboardingState =
  | "queued"
  | "running"
  | "waiting"
  | OnboardingEndStatus;

export type OnboardingQuestion = {
  id: string;
  question: string;
  why?: string;
  options: { label: string; detail?: string }[];
  allowOther: boolean;
};

export type OnboardingResponse = {
  id: string;
  status: OnboardingState;
  /** The question it's waiting on, while `waiting`. */
  question: OnboardingQuestion | null;
  /** The environment version it saved. */
  environmentVersion: number | null;
  error: { code: string; message: string | null } | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
};

export type OnboardingCancelOutcome = "cancelled" | "stopping";
