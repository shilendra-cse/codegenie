import { afterAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "@codegenie/sandbox/testing";
import { createToolContext } from "../core/context.js";
import { runChecks } from "./run-checks.js";

const sandbox = await dockerSandboxOrSkip("run_checks");

describe.skipIf(!sandbox)("run_checks against DockerSandbox", () => {
  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("reports pass/fail with the failing output", async () => {
    const ctx = createToolContext(sandbox!, [
      { name: "lint", command: "echo 'lint ok'", cwd: "." },
      {
        name: "test",
        command:
          "echo 'running tests'; echo 'FAIL math.test.ts: expected 2, got 3' >&2; exit 1",
        cwd: ".",
      },
    ]);
    const out = await runChecks(ctx, {});
    expect(out).toMatch(/^✓ lint: passed/);
    expect(out).toMatch(/\n✗ test: failed \(exit 1\)/);
    expect(out).toContain("1 of 2 checks failed.");
    expect(out).toContain("FAIL math.test.ts: expected 2, got 3");
  });

  it("runs each check in its own folder", async () => {
    await sandbox!.exec("mkdir -p web api");
    const ctx = createToolContext(sandbox!, [
      { name: "test", command: "pwd", cwd: "web" },
      { name: "test", command: "pwd && exit 1", cwd: "api" },
    ]);
    const out = await runChecks(ctx, {});
    expect(out).toMatch(/^✓ test \(web\): passed/);
    expect(out).toMatch(/\n✗ test \(api\): failed \(exit 1\)/);
    expect(out).toContain("/workspace/api");
  });
});
