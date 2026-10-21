import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import {
  blobSha,
  DeliverError,
  listChanges,
  MAX_FILES,
  parseRawDiff,
} from "./change-set.js";

const A = "a".repeat(40);
const B = "b".repeat(40);
const ZERO = "0".repeat(40);
const raw = (...entries: [string, string][]) =>
  entries.map(([meta, path]) => `${meta}\0${path}\0`).join("");

describe("parseRawDiff", () => {
  it("splits git's raw output into writes and deletions", () => {
    expect(
      parseRawDiff(
        raw(
          [`:100644 100644 ${A} ${B} M`, "src/app.ts"],
          [`:100644 100755 ${A} ${A} M`, "scripts/build.sh"],
          [`:000000 120000 ${ZERO} ${B} A`, "link"],
          [`:100644 000000 ${A} ${ZERO} D`, "old name.ts"],
        ),
      ),
    ).toEqual({
      writes: [
        { path: "src/app.ts", mode: "100644", sha: B },
        { path: "scripts/build.sh", mode: "100755", sha: A },
        { path: "link", mode: "120000", sha: B },
      ],
      deletions: ["old name.ts"],
    });
    expect(parseRawDiff("")).toEqual({ writes: [], deletions: [] });
  });

  it("refuses submodules and file names that aren't UTF-8", () => {
    expect(() =>
      parseRawDiff(raw([`:000000 160000 ${ZERO} ${A} A`, "vendor/lib"])),
    ).toThrow(DeliverError);
    expect(() =>
      parseRawDiff(raw([`:160000 000000 ${A} ${ZERO} D`, "vendor/lib"])),
    ).toThrow(/submodule/);
    expect(() =>
      parseRawDiff(raw([`:000000 100644 ${ZERO} ${A} A`, "caf�.txt"])),
    ).toThrow(/UTF-8/);
  });
});

describe("blobSha", () => {
  it("matches git's blob hashes", () => {
    expect(blobSha(Buffer.from(""))).toBe(
      "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
    );
    expect(blobSha(Buffer.from("hello\n"))).toBe(
      "ce013625030ba8dba906f756967f9e9ca394464a",
    );
  });
});

describe("listChanges", () => {
  function sandboxWith(diff: string) {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) => {
      if (command.startsWith("git rev-parse")) return { stdout: `${A}\n` };
      if (command.startsWith("git diff-tree")) return { stdout: diff };
      return {};
    };
    return sandbox;
  }

  it("refuses more files than can be delivered", async () => {
    const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => [
      `:100644 000000 ${A} ${ZERO} D`,
      `file-${i}`,
    ]) as [string, string][];
    await expect(listChanges(sandboxWith(raw(...many)), B, B)).rejects.toThrow(
      `${MAX_FILES + 1} files changed`,
    );
  });

  it("refuses a checkout without a commit to build on", async () => {
    const sandbox = sandboxWith("");
    sandbox.execHandler = () => ({ exitCode: 1 });
    await expect(listChanges(sandbox, B, B)).rejects.toThrow(
      "no commit to deliver the changes on",
    );
  });

  it("fails when a command's output was cut off", async () => {
    const sandbox = sandboxWith("");
    sandbox.execHandler = (command) =>
      command.startsWith("git rev-parse")
        ? { stdout: `${A}\n` }
        : { truncated: true };
    await expect(listChanges(sandbox, B, B)).rejects.toThrow(
      "Could not list the changes: output too large",
    );
  });
});
