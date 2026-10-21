import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { createBaseline, findBaseline } from "./baseline.js";

describe("createBaseline", () => {
  it("commits the starting state and returns its sha", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ stdout: "abc123\n" });
    expect(await createBaseline(sandbox)).toBe("abc123");
    const command = sandbox.execCalls[0]!.command;
    expect(command).toContain("echo node_modules/ >> .git/info/exclude");
    expect(command).toContain(
      'git commit -q --allow-empty --no-verify -m "codegenie: baseline"',
    );
  });

  it("fails clearly when git fails", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ exitCode: 1, stderr: "boom" });
    await expect(createBaseline(sandbox)).rejects.toThrow(
      /baseline commit: boom/,
    );
  });
});

describe("findBaseline", () => {
  it("finds the baseline commit by its message", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ stdout: "abc123\n" });
    expect(await findBaseline(sandbox)).toBe("abc123");
    expect(sandbox.execCalls[0]!.command).toContain(
      '--grep="codegenie: baseline"',
    );
  });

  it.each([
    ["there's no such commit", {}],
    [
      "the folder isn't a git repository yet",
      { exitCode: 128, stderr: "not a git repository" },
    ],
  ])("returns null when %s", async (_case, answer) => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => answer;
    expect(await findBaseline(sandbox)).toBeNull();
  });
});
