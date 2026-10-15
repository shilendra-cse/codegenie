import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { runInstall } from "./run-install.js";

/** A sandbox whose exec succeeds or fails depending on which install command it sees. */
function sandboxWhere(
  outcomes: Record<string, { ok: boolean; output?: string }>,
) {
  const sandbox = new FakeSandbox();
  sandbox.execHandler = (command) => {
    const match = Object.entries(outcomes).find(([cmd]) =>
      command.includes(`{ ${cmd}\n}`),
    );
    if (!match) throw new Error(`unexpected command: ${command}`);
    const [, { ok, output }] = match;
    return { exitCode: ok ? 0 : 1, stdout: output ?? "" };
  };
  return sandbox;
}

describe("runInstall", () => {
  it("skips when there is nothing to install", async () => {
    expect(await runInstall(new FakeSandbox(), null)).toEqual({
      command: null,
      status: "skipped",
      durationMs: 0,
    });
  });

  it("succeeds with the frozen install and logs its output", async () => {
    const sandbox = sandboxWhere({ "npm ci": { ok: true } });
    const result = await runInstall(sandbox, {
      frozen: "npm ci",
      fallback: "npm install",
    });
    expect(result).toMatchObject({
      command: "npm ci",
      status: "ok",
      logPath: "/tmp/codegenie/logs/setup-install.log",
    });
    expect(sandbox.execCalls).toHaveLength(1);
    expect(sandbox.execCalls[0]!.command).toContain("set -o pipefail");
    expect(sandbox.execCalls[0]!.options.timeoutMs).toBe(10 * 60_000);
  });

  it("falls back to the lenient install when the frozen one fails", async () => {
    const sandbox = sandboxWhere({
      "npm ci": { ok: false, output: "lockfile out of date" },
      "npm install": { ok: true },
    });
    expect(
      await runInstall(sandbox, { frozen: "npm ci", fallback: "npm install" }),
    ).toMatchObject({
      command: "npm install",
      status: "ok-after-retry",
      logPath: "/tmp/codegenie/logs/setup-install-retry.log",
    });
  });

  it("reports failure with the end of the output when both fail", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    const sandbox = sandboxWhere({
      "npm ci": { ok: false },
      "npm install": { ok: false, output: lines },
    });
    const result = await runInstall(sandbox, {
      frozen: "npm ci",
      fallback: "npm install",
    });
    expect(result).toMatchObject({ command: "npm install", status: "failed" });
    expect(result.errorTail!.split("\n")).toHaveLength(40);
    expect(result.errorTail!.endsWith("line 100")).toBe(true);
  });

  it("fails without retrying when there is no fallback", async () => {
    const sandbox = sandboxWhere({
      "npm install": { ok: false, output: "E404" },
    });
    expect(
      await runInstall(sandbox, { frozen: "npm install", fallback: null }),
    ).toMatchObject({
      command: "npm install",
      status: "failed",
      errorTail: "E404",
    });
    expect(sandbox.execCalls).toHaveLength(1);
  });

  it("treats a timeout as a failure", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ exitCode: 124, timedOut: true });
    const result = await runInstall(sandbox, {
      frozen: "npm install",
      fallback: null,
    });
    expect(result.status).toBe("failed");
    expect(result.errorTail).toMatch(/timed out after 10 minutes/);
  });
});
