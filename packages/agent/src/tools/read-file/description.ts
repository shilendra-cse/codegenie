export const readFileDescription = `Read a file with line numbers.
- Output lines look like "  12│ code". The number and "│ " are NOT part of the file: never include them in edit_file's oldString.
- Reads up to 2000 lines at a time. For longer files, use offset (1-based line number) to continue where the header says.
- Read a file before editing or overwriting it.
- Can also read saved command output in /tmp/codegenie/logs/.`;
