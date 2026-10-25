import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/projects/42?tab=settings")).toBe(
      "/projects/42?tab=settings",
    );
  });

  it.each([
    ["missing", null],
    ["another site", "https://evil.example"],
    ["a protocol-relative address", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a relative path", "projects"],
  ])("falls back for %s", (_case, next) => {
    expect(safeNext(next)).toBe("/inbox");
  });
});
