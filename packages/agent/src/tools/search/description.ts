// What the model reads about this tool: effectively part of the prompt. Tune against evals.
export const searchDescription = `Search file contents with ripgrep (regular expressions).
- Returns matches as "path:line: text". Respects .gitignore, so node_modules is skipped.
- Narrow results with path (a folder or file) and glob (e.g. "*.ts" or "src/**/*.tsx").
- Use this to find where things are defined or used before reading files.
- Can also search saved command output: set path to a file in /tmp/codegenie/logs/.`;
