export function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function shellJoin(args: string[]) {
  return args.map(shellQuote).join(" ");
}
