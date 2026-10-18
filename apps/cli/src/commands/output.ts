export const out = (line: string) => process.stdout.write(`${line}\n`);
export const err = (line: string) => process.stderr.write(`${line}\n`);
