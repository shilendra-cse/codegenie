// What the model reads about this tool: effectively part of the prompt. Tune against evals.
export const finishTaskDescription = `Call this when the task is complete, with a short summary of what you changed and why.
- Run checks first and make sure they pass, or explain in the summary why they don't.
- The summary is shown to the user and used in the pull request description.
- This ends your work on the task.`;
