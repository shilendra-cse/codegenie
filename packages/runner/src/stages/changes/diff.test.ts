import { FakeSandbox } from "@hobai/sandbox/testing";
import { describe, expect, it } from "vitest";
import { collectDiff, parseNumstat } from "./diff.js";

describe("collectDiff", () => {
  it("returns the patch and per-file changes against the baseline", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) =>
      command.includes("--numstat")
        ? { stdout: "3\t0\tsrc/app.ts\n15\t0\ttest/health.test.ts\n" }
        : command.includes("--no-color")
          ? { stdout: "diff --git a/src/app.ts b/src/app.ts\n" }
          : {};
    expect(await collectDiff(sandbox, "abc123")).toEqual({
      patch: "diff --git a/src/app.ts b/src/app.ts\n",
      truncated: false,
      files: [
        { path: "src/app.ts", added: 3, removed: 0 },
        { path: "test/health.test.ts", added: 15, removed: 0 },
      ],
    });
    expect(sandbox.execCalls.map((c) => c.command)).toEqual([
      "git add -A",
      "git diff --cached --numstat 'abc123'",
      "git diff --cached --no-color 'abc123'",
    ]);
  });
});

describe("parseNumstat", () => {
  it("handles binary files", () => {
    expect(parseNumstat("-\t-\timg.png\n")).toEqual([
      { path: "img.png", added: null, removed: null },
    ]);
  });
});
