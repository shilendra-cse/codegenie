import path from "node:path";

export const EVALS_DIR = path.join(import.meta.dirname, "..");
export const REPOS_DIR = path.join(EVALS_DIR, "repos");
export const RESULTS_DIR = path.join(EVALS_DIR, "results");
