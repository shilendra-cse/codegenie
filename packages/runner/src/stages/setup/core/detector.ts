import type { Check, EcosystemId, PackageManager } from "@codegenie/shared";
import type { RepoReader } from "./repo-reader.js";

/** How to install dependencies: a reproducible command first, a lenient one if it fails. */
export type InstallPlan = {
  frozen: string;
  fallback: string | null;
};

export type Detection = {
  ecosystem: EcosystemId;
  packageManager: PackageManager | null;
  /** null when there is nothing to install or it can't be installed. */
  install: InstallPlan | null;
  checks: Check[];
  notes: string[];
};

/**
 * Recognises one ecosystem (Node today; Python, Go… later) and describes how to
 * install and check it. Returns null when the repository isn't that ecosystem.
 */
export interface EcosystemDetector {
  id: EcosystemId;
  detect(repo: RepoReader): Promise<Detection | null>;
}
