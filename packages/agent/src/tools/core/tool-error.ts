/**
 * An expected tool failure (bad input, missing file, no unique match…).
 * Returned to the model as text so it can correct itself; never ends the run.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
