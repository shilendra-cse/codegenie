/** Quotes a value as a single shell word: `it's` → `'it'\''s'`. */
export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
