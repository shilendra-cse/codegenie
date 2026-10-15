import { afterAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "../../testing/docker.js";
import { createToolContext } from "../core/context.js";
import { runChecks } from "./run-checks.js";

const sandbox = await dockerSandboxOrSkip("run_checks");

describe.skipIf(!sandbox)("run_checks against DockerSandbox", () => {
  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("reports pass/fail with the failing output", async () => {
    const ctx = createToolContext(sandbox!, {
      lint: "echo 'lint ok'",
      test: "echo 'running tests'; echo 'FAIL math.test.ts: expected 2, got 3' >&2; exit 1",
    });
    const out = await runChecks(ctx, {});
    expect(out).toMatch(/^✓ lint: passed/);
    expect(out).toMatch(/\n✗ test: failed \(exit 1\)/);
    expect(out).toContain("1 of 2 checks failed.");
    expect(out).toContain("FAIL math.test.ts: expected 2, got 3");
  });
});
