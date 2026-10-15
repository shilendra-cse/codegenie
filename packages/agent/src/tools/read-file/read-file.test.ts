import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../core/context.js";
import { readFile } from "./read-file.js";

function setup(files: Record<string, string>) {
  return createToolContext(new FakeSandbox(files));
}

describe("read_file", () => {
  it("numbers lines and shows a header with the range", async () => {
    const ctx = setup({ "src/a.ts": "one\ntwo\nthree\n" });
    expect(await readFile(ctx, { path: "src/a.ts" })).toBe(
      "src/a.ts — lines 1–3 of 3\n1│ one\n2│ two\n3│ three",
    );
  });

  it("supports offset and limit and says how to continue", async () => {
    const content = Array.from({ length: 12 }, (_, i) => `l${i + 1}`).join(
      "\n",
    );
    const ctx = setup({ "f.txt": content });
    expect(await readFile(ctx, { path: "f.txt", offset: 9, limit: 2 })).toBe(
      "f.txt — lines 9–10 of 12 (use offset=11 to continue)\n 9│ l9\n10│ l10",
    );
  });

  it("errors when offset is past the end", async () => {
    const ctx = setup({ "f.txt": "a\nb\n" });
    await expect(readFile(ctx, { path: "f.txt", offset: 5 })).rejects.toThrow(
      /past the end.*2 lines/,
    );
  });

  it("handles empty and binary files", async () => {
    const ctx = setup({ "empty.txt": "", "img.png": "PNG\0\0data" });
    expect(await readFile(ctx, { path: "empty.txt" })).toBe(
      "empty.txt — empty file",
    );
    await expect(readFile(ctx, { path: "img.png" })).rejects.toThrow(/binary/);
  });

  it("cuts very long lines", async () => {
    const ctx = setup({ "min.js": "x".repeat(5000) });
    const out = await readFile(ctx, { path: "min.js" });
    expect(out).toMatch(/… \[line truncated\]$/);
    expect(out.length).toBeLessThan(2100);
  });

  it("marks the file as read", async () => {
    const ctx = setup({ "a.ts": "x\n" });
    await readFile(ctx, { path: "a.ts" });
    expect(ctx.readFiles.has("/workspace/a.ts")).toBe(true);
  });
});
