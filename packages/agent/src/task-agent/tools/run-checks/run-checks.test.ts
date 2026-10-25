import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@hobai/sandbox/testing";
import { createToolContext } from "../../../tools/core/context.js";
import { LOG_DIR } from "../../../tools/core/workspace-path.js";
import { runChecks } from "./run-checks.js";

describe("run_checks", () => {
  it("explains when no checks are configured", async () => {
    const ctx = createToolContext(new FakeSandbox());
    expect(await runChecks(ctx, {})).toMatch(/No check commands were detected/);
  });

  it("runs configured checks in order and shows the end of failing output", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = (command) =>
      command.includes("pnpm test")
        ? { exitCode: 1, stdout: "running…\nFAIL user.test.ts\n1 failed" }
        : { stdout: "ok" };
    const ctx = createToolContext(sandbox, [
      { name: "test", command: "pnpm test", cwd: "." },
      { name: "lint", command: "pnpm lint", cwd: "." },
    ]);

    const out = await runChecks(ctx, {});
    const lines = out.split("\n");
    expect(lines[0]).toMatch(/^✓ lint: passed in [\d.]+s — pnpm lint$/);
    expect(lines[1]).toMatch(
      /^✗ test: failed \(exit 1\) in [\d.]+s — pnpm test$/,
    );
    expect(lines[2]).toBe("1 of 2 checks failed.");
    expect(out).toContain(
      `--- test output (full log: ${LOG_DIR}/0002-check-test.log) ---`,
    );
    expect(out).toContain("FAIL user.test.ts\n1 failed");
  });

  it("runs only the requested checks", async () => {
    const sandbox = new FakeSandbox();
    const ctx = createToolContext(sandbox, [
      { name: "lint", command: "pnpm lint", cwd: "." },
      { name: "test", command: "pnpm test", cwd: "." },
    ]);
    expect(await runChecks(ctx, { only: ["test"] })).toMatch(
      /^✓ test: passed.*\nAll checks passed\.$/,
    );
    expect(sandbox.execCalls).toHaveLength(1);
    expect(await runChecks(ctx, { only: ["build"] })).toMatch(
      /None of the requested checks \(build\)/,
    );
  });

  it("treats a timed-out check as failed", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ exitCode: 124, timedOut: true });
    const ctx = createToolContext(sandbox, [
      { name: "test", command: "pnpm test", cwd: "." },
    ]);
    expect(await runChecks(ctx, {})).toMatch(/✗ test: timed out/);
  });

  it("passes each check's folder to the sandbox and labels same-named checks", async () => {
    const sandbox = new FakeSandbox();
    const ctx = createToolContext(sandbox, [
      { name: "test", command: "npm test", cwd: "web" },
      { name: "test", command: "pytest", cwd: "api" },
      { name: "lint", command: "npm run lint", cwd: "." },
    ]);
    const out = await runChecks(ctx, {});
    expect(sandbox.execCalls.map((c) => c.options.cwd)).toEqual([
      ".",
      "web",
      "api",
    ]);
    expect(out.split("\n").slice(0, 3)).toEqual([
      expect.stringMatching(/^✓ lint: passed/),
      expect.stringMatching(/^✓ test \(web\): passed/),
      expect.stringMatching(/^✓ test \(api\): passed/),
    ]);
  });
});
