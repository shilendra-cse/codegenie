export * from "./api/index.js";

export type {
  Check,
  CheckName,
  EcosystemId,
  PackageManager,
} from "./types/setup.js";

export { CHECK_NAMES } from "./types/setup.js";

export type {
  EnvironmentSource,
  SetupStep,
  StepStatus,
  CheckStatus,
  EnvironmentDecision,
  EnvironmentConfig,
  StepResult,
  CheckResult,
  EnvironmentHealth,
  StoredEnvironment,
  EnvironmentStore,
  SetupResult,
  EnvironmentProposal,
  TryResult,
  SetupQuestion,
  SetupAnswer,
  UserChannel,
  OnboardingStatus,
} from "./types/environment.js";

export { checkKey } from "./types/environment.js";

export {
  ANSWER_CHANNEL,
  CANCEL_CHANNEL,
  DEFAULT_AGENT_MODEL,
  WORK_QUEUE,
  onboardingChannel,
  runChannel,
  type QueuedWork,
  type QueuedWorkKind,
} from "./types/queue.js";
