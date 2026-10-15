/** Quotes a value as a single shell word: `it's` → `'it'\''s'`. */
export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Joins arguments into a shell command, quoting each one. */
export function shellJoin(args: string[]) {
  return args.map(shellQuote).join(" ");
}
