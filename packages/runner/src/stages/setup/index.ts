export {
  runSetup,
  type RunSetupOptions,
  type SetupOverrides,
} from "./run-setup.js";

export type {
  Detection,
  EcosystemDetector,
  InstallPlan,
} from "./core/detector.js";
export { RepoReader } from "./core/repo-reader.js";
export { DETECTORS } from "./detectors/index.js";
