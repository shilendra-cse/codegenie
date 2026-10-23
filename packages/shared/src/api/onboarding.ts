import type { RunEvent, RunEventDone } from "./events.js";

export type OnboardingEndStatus = "succeeded" | "failed" | "cancelled";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** What a setup records: the runner's events (minus the run id) plus its own. */
export type OnboardingEventBody =
  | DistributiveOmit<Exclude<RunEvent, RunEventDone>, "runId" | "seq">
  | { type: "info"; ts: string; message: string }
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
