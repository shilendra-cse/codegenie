import { SANDBOX_LOG_DIR } from "@hobai/sandbox";

export const searchDescription = `Search file contents with ripgrep (regular expressions).
- Returns matches as "path:line: text". Respects .gitignore, so node_modules is skipped.
- Narrow results with path (a folder or file) and glob (e.g. "*.ts" or "src/**/*.tsx").
- Use this to find where things are defined or used before reading files.
- Can also search saved command output: set path to a file in ${SANDBOX_LOG_DIR}/.`;
