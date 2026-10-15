// What the model reads about this tool: effectively part of the prompt. Tune against evals.
export const runChecksDescription = `Run the repository's checks (lint, typecheck, test, build) and report which pass.
- Run this after making changes, and fix failures before finishing.
- Use only to run a subset, e.g. ["test"].
- Failures show the end of the output; the full output is saved to a log file.`;
