import type { Check, EcosystemId, PackageManager } from "@codegenie/shared";
import type { RepoReader } from "./repo-reader.js";

export type InstallPlan = {
  frozen: string;
  fallback: string | null;
};

export type Detection = {
  ecosystem: EcosystemId;
  packageManager: PackageManager | null;
  install: InstallPlan | null;
  checks: Check[];
  notes: string[];
};

export interface EcosystemDetector {
  id: EcosystemId;
  detect(repo: RepoReader): Promise<Detection | null>;
}
