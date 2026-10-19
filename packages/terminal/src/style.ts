import pc from "picocolors";

/** Colors by meaning, so every command uses them the same way. */
export type Style = {
  ok: (text: string) => string;
  fail: (text: string) => string;
  warn: (text: string) => string;
  dim: (text: string) => string;
  accent: (text: string) => string;
  bold: (text: string) => string;
};

export function createStyle(colors: boolean): Style {
  const c = pc.createColors(colors);
  return {
    ok: c.green,
    fail: c.red,
    warn: c.yellow,
    dim: c.dim,
    accent: c.cyan,
    bold: c.bold,
  };
}

/** Plain text: log files, pipes, --json, NO_COLOR. */
export const plain = createStyle(false);

/** Colors when the stream is a terminal and NO_COLOR isn't set (FORCE_COLOR forces them). */
export function styleFor(stream: { isTTY?: boolean }): Style {
  return createStyle(pc.isColorSupported && Boolean(stream.isTTY));
}

/**
 * Animations (spinners, lines updated in place) only in a real terminal, never in CI.
 * A terminal reporting 0 rows (some IDE consoles) can't show them either.
 */
export function isInteractive(stream: { isTTY?: boolean; rows?: number }) {
  return Boolean(stream.isTTY) && stream.rows !== 0 && !process.env.CI;
}
