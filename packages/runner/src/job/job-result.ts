import type { AgentResult } from "@codegenie/agent";
import type { SetupResult } from "@codegenie/shared";
import type { Diff } from "../stages/changes/index.js";
import type { VerifyResult } from "../stages/verify/index.js";

export type JobStatus = "succeeded" | "incomplete" | "failed" | "cancelled";
export type JobStageName =
  | "sandbox"
  | "checkout"
  | "setup"
  | "agent"
  | "verify";

export type JobResult = {
  status: JobStatus;
  failedStage?: JobStageName;
  error?: string;
  sandboxId?: string;
  checkout?: { description: string; files: number | null };
  setup?: SetupResult;
  agent?: AgentResult;
  verify?: VerifyResult;
  diff?: Diff;
  durationMs: number;
};
