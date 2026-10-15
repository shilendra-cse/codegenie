import { describe, expect, it } from "vitest";
import { numberLines, splitLines } from "./lines.js";

describe("splitLines", () => {
  it("does not add a phantom line after a trailing newline", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
    expect(splitLines("\n")).toEqual([""]);
  });
});

describe("numberLines", () => {
  it("right-aligns numbers to the widest line number", () => {
    expect(numberLines(["x", "y"], 9)).toBe(" 9│ x\n10│ y");
  });

  it("cuts very long lines", () => {
    const out = numberLines(["z".repeat(3000)], 1);
    expect(out).toMatch(/^1│ z{2000} … \[line truncated\]$/);
  });
});
