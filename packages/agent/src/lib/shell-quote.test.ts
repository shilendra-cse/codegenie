import { describe, expect, it } from "vitest";
import { shellJoin, shellQuote } from "./shell-quote.js";

describe("shellQuote", () => {
  it("quotes values as single shell words, including single quotes", () => {
    expect(shellQuote("plain")).toBe("'plain'");
    expect(shellQuote("it's $HOME")).toBe(`'it'\\''s $HOME'`);
    expect(shellJoin(["rg", "a b", "--"])).toBe("'rg' 'a b' '--'");
  });
});
