import { describe, expect, it } from "vitest";
import { truncateForModel } from "./truncate.js";

describe("truncateForModel", () => {
  it("returns short text unchanged", () => {
    expect(truncateForModel("hello", { maxChars: 10 })).toEqual({
      text: "hello",
      truncated: false,
    });
  });

  it("keeps whole lines from the start and end with an omitted-lines marker", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    const result = truncateForModel(text, { maxChars: 100 });
    expect(result.truncated).toBe(true);
    const lines = result.text.split("\n");
    expect(lines[0]).toBe("line 1");
    expect(lines.at(-1)).toBe("line 100");
    expect(result.text).toMatch(/… \[\d+ lines omitted\] …/);
    // Every kept line is a whole original line.
    for (const line of lines.filter((l) => !l.startsWith("…"))) {
      expect(line).toMatch(/^line \d+$/);
    }
  });

  it("gives the end more room than the start by default", () => {
    const text = Array.from({ length: 1000 }, () => "xxxxxxxxx").join("\n");
    const [head, tail] = truncateForModel(text, { maxChars: 1000 }).text.split(
      /\n… \[\d+ lines omitted\] …\n/,
    );
    expect(tail!.length).toBeGreaterThan(head!.length);
  });

  it("respects a custom head ratio", () => {
    const text = Array.from({ length: 1000 }, () => "xxxxxxxxx").join("\n");
    const [head, tail] = truncateForModel(text, {
      maxChars: 1000,
      headRatio: 0.2,
    }).text.split(/\n… \[\d+ lines omitted\] …\n/);
    expect(head!.length).toBeLessThan(250);
    expect(tail!.length).toBeGreaterThan(700);
  });

  it("falls back to character slicing for a single huge line", () => {
    const result = truncateForModel("a".repeat(500), { maxChars: 100 });
    expect(result.truncated).toBe(true);
    expect(result.text).toMatch(/… \[400 characters omitted\] …/);
  });
});
