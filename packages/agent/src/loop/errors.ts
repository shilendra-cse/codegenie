import { SandboxGoneError, SandboxUnavailableError } from "@codegenie/sandbox";

export function isInfrastructureError(error: unknown) {
  return (
    error instanceof SandboxGoneError ||
    error instanceof SandboxUnavailableError
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
