export const SYMBOLS = {
  start: "◆",
  section: "◇",
  bar: "│",
  end: "└",
  tool: "▸",
  ok: "✓",
  fail: "✗",
  warn: "⚠",
  dot: "·",
} as const;

const SPINNER = ["◒", "◐", "◓", "◑"];
const SPINNER_FRAME_MS = 120;

export function spinnerFrame(now = Date.now()) {
  return SPINNER[Math.floor(now / SPINNER_FRAME_MS) % SPINNER.length]!;
}
