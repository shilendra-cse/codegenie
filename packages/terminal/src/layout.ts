import type { Style } from "./style.js";
import { SYMBOLS } from "./symbols.js";

const WIDTH = 48;

/** The output's opening line: "◆ hobai · gpt-6-luna · ../repo". */
export function intro(style: Style, title: string) {
  return `${style.accent(SYMBOLS.start)} ${style.bold(title)}`;
}

/** A section header: "◇ Setup ────────────". */
export function section(style: Style, title: string) {
  const rule = "─".repeat(Math.max(3, WIDTH - title.length - 3));
  return `${style.accent(SYMBOLS.section)} ${style.bold(title)} ${style.dim(rule)}`;
}

/** A line inside a section, behind the gutter. */
export function line(style: Style, text = "") {
  return text ? `${style.dim(SYMBOLS.bar)} ${text}` : style.dim(SYMBOLS.bar);
}

/** The closing line: "└ ✓ succeeded · 9 steps". */
export function outro(style: Style, text: string) {
  return `${style.dim(SYMBOLS.end)} ${text}`;
}
