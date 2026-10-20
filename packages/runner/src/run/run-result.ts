import type { AgentResult } from "@codegenie/agent";
import type { FinalRunStatus, SetupResult } from "@codegenie/shared";
import type { Diff } from "../stages/changes/index.js";
import type { VerifyResult } from "../stages/verify/index.js";

export type RunStageName =
  | "sandbox"
  | "checkout"
  | "setup"
  | "agent"
  | "verify";

export type RunResult = {
  status: FinalRunStatus;
  failedStage?: RunStageName;
  error?: string;
  sandboxId?: string;
  checkout?: { description: string; files: number | null };
  setup?: SetupResult;
  agent?: AgentResult;
  verify?: VerifyResult;
  diff?: Diff;
  durationMs: number;
};
