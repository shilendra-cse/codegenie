export { runTask, type RunTaskOptions } from "./run/run-task.js";
export type {
  Deliver,
  Delivery,
  RunResult,
  RunStageName,
} from "./run/run-result.js";
export type { ChangeSet, FileMode, FileWrite } from "./stages/deliver/index.js";
export * from "./environment/index.js";
export * from "./stages/checkout/index.js";
export {
  collectDiff,
  findBaseline,
  type Diff,
  type FileChange,
} from "./stages/changes/index.js";
export {
  compareCheck,
  compareChecks,
  type CheckComparison,
  type ComparedCheck,
  type VerifyResult,
} from "./stages/verify/index.js";
export * from "./onboarding/index.js";
