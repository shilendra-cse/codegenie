export const MAX_LINE_CHARS = 2000;

export function splitLines(content: string) {
  if (content === "") return [];
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();
  return lines;
}

export function numberLines(
  lines: string[],
  firstLine: number,
  width?: number,
) {
  const pad = width ?? String(firstLine + lines.length - 1).length;
  return lines
    .map((line, i) => {
      const text =
        line.length > MAX_LINE_CHARS
          ? `${line.slice(0, MAX_LINE_CHARS)} … [line truncated]`
          : line;
      return `${String(firstLine + i).padStart(pad)}│ ${text}`;
    })
    .join("\n");
}
