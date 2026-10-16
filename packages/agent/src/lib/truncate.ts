export const MAX_TOOL_OUTPUT_CHARS = 30_000;

export type TruncateOptions = {
  maxChars?: number;
  headRatio?: number;
};

export type TruncateResult = {
  text: string;
  truncated: boolean;
};

export function truncateForModel(
  text: string,
  options: TruncateOptions = {},
): TruncateResult {
  const maxChars = options.maxChars ?? MAX_TOOL_OUTPUT_CHARS;
  if (text.length <= maxChars) return { text, truncated: false };

  const headBudget = Math.floor(maxChars * (options.headRatio ?? 0.4));
  const tailBudget = maxChars - headBudget;
  const lines = text.split("\n");

  const head: string[] = [];
  let headChars = 0;
  for (const line of lines) {
    if (headChars + line.length + 1 > headBudget) break;
    head.push(line);
    headChars += line.length + 1;
  }

  const tail: string[] = [];
  let tailChars = 0;
  for (let i = lines.length - 1; i >= head.length; i--) {
    const line = lines[i]!;
    if (tailChars + line.length + 1 > tailBudget) break;
    tail.unshift(line);
    tailChars += line.length + 1;
  }

  if (head.length === 0 && tail.length === 0) {
    const omitted = text.length - headBudget - tailBudget;
    return {
      text: `${text.slice(0, headBudget)}\n… [${omitted} characters omitted] …\n${text.slice(-tailBudget)}`,
      truncated: true,
    };
  }

  const omittedLines = lines.length - head.length - tail.length;
  return {
    text: [...head, `… [${omittedLines} lines omitted] …`, ...tail].join("\n"),
    truncated: true,
  };
}
