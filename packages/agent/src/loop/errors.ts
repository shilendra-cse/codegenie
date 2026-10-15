import { SandboxGoneError, SandboxUnavailableError } from "@codegenie/sandbox";

/** Failures the model can't fix (the sandbox is gone or unusable): the run must stop. */
export function isInfrastructureError(error: unknown) {
  return (
    error instanceof SandboxGoneError ||
    error instanceof SandboxUnavailableError
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
