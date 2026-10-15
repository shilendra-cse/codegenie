// What the model reads about this tool: effectively part of the prompt. Tune against evals.
export const editFileDescription = `Replace text in an existing file.
- oldString must match the file exactly, including whitespace and indentation, and must appear exactly once.
  If it appears more than once, include more surrounding lines to make it unique, or set replaceAll to true.
- You must read the file first. Copy oldString from read_file output without the line-number prefix.
- Prefer several small, precise edits over rewriting a whole file.
- To create a new file, use write_file.`;
