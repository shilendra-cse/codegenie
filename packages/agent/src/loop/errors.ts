import { SandboxGoneError, SandboxUnavailableError } from "@hobai/sandbox";

export function isInfrastructureError(error: unknown) {
  return (
    error instanceof SandboxGoneError ||
    error instanceof SandboxUnavailableError
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
