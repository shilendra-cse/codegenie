import type { Check, EcosystemId, PackageManager } from "@hobai/shared";
import type { RepoReader } from "./repo-reader.js";

export type InstallPlan = {
  frozen: string;
  fallback: string | null;
};

export type Project = {
  /** Where dependencies are installed; its checks may run in other folders (workspace packages). */
  cwd: string;
  packageManager: PackageManager | null;
  install: InstallPlan | null;
  checks: Check[];
};

export type Detection = {
  ecosystem: EcosystemId;
  projects: Project[];
  notes: string[];
};

export interface EcosystemDetector {
  id: EcosystemId;
  detect(repo: RepoReader): Promise<Detection | null>;
}
