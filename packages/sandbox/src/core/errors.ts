export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class SandboxUnavailableError extends SandboxError {}

export class SandboxCreateError extends SandboxError {}

export class SandboxGoneError extends SandboxError {}

export class SandboxFileError extends SandboxError {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message);
  }
}
