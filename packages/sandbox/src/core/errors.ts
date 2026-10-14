export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The sandbox backend can't be used: Docker isn't running, or the image hasn't been built. */
export class SandboxUnavailableError extends SandboxError {}

/** The backend is available but the sandbox failed to start. */
export class SandboxCreateError extends SandboxError {}

/** The sandbox no longer exists (destroyed, or removed externally). */
export class SandboxGoneError extends SandboxError {}

/** A file operation failed (missing file, not a regular file, permission denied…). */
export class SandboxFileError extends SandboxError {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message);
  }
}
