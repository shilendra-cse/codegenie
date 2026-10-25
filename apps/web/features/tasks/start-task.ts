import type { ProjectResponse } from "@hobai/shared";
import { ApiError } from "@/lib/api/client";
import { environmentPath } from "@/lib/routes";

export type Fix = { label: string; href: string };

export type Readiness =
  | { ready: true }
  | { ready: false; reason: string; fix: Fix | null };

/** Whether a task can start on this project, and if not, why and how to fix it. */
export function taskReadiness({
  id,
  environment,
  installation,
}: ProjectResponse): Readiness {
  if (installation.uninstalled || installation.suspended) {
    return {
      ready: false,
      reason: installation.uninstalled
        ? "GitHub App removed"
        : "GitHub App suspended",
      fix: null,
    };
  }
  if (!environment) {
    return {
      ready: false,
      reason: "Not set up",
      fix: { label: "Set up", href: environmentPath(id) },
    };
  }
  if (environment.health === "needs_attention") {
    return {
      ready: false,
      reason: "Needs attention",
      fix: { label: "Re-run setup", href: environmentPath(id) },
    };
  }
  return { ready: true };
}

export type StartTaskError = { message: string; fix: Fix | null };

export function startTaskError(
  error: unknown,
  projectId: string,
): StartTaskError {
  if (!(error instanceof ApiError)) {
    return { message: "Something went wrong. Try again.", fix: null };
  }
  switch (error.code) {
    case "PROJECT_NOT_SET_UP":
      return {
        message: "Set up this project before starting a task.",
        fix: { label: "Set up", href: environmentPath(projectId) },
      };
    case "PROJECT_NEEDS_ATTENTION":
      return {
        message: "This project's setup needs attention.",
        fix: { label: "Re-run setup", href: environmentPath(projectId) },
      };
    default:
      // The server's own message already says what to do (busy, App suspended or removed, invalid input).
      return { message: error.message, fix: null };
  }
}

/** The first of the preferred projects that can take a task, else the first that can. */
export function defaultProjectId(
  projects: ProjectResponse[],
  preferred: (string | null | undefined)[],
): string | null {
  const ready = projects.filter((p) => taskReadiness(p).ready);
  const match = preferred
    .map((id) => ready.find((p) => p.id === id))
    .find(Boolean);
  return (match ?? ready[0])?.id ?? null;
}
