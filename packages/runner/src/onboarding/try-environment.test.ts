import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { createTryEnvironment } from "./try-environment.js";

const install = { name: "install", cwd: "api", command: "npm ci" };
const lint = { name: "lint" as const, cwd: "api", command: "npm run lint" };

describe("createTryEnvironment", () => {
  it("doesn't rerun steps that already succeeded, and keeps logs of each attempt apart", async () => {
    const sandbox = new FakeSandbox();
    const tryEnvironment = createTryEnvironment(sandbox);

    await tryEnvironment({ steps: [install], checks: [lint] });
    const second = await tryEnvironment({
      steps: [
        install,
        { name: "generate", cwd: "api", command: "npx prisma generate" },
      ],
      checks: [lint],
    });

    const commands = sandbox.execCalls.map((c) => c.command);
    expect(commands.filter((c) => c.includes("npm ci"))).toHaveLength(1);
    expect(commands.filter((c) => c.includes("prisma generate"))).toHaveLength(
      1,
    );
    expect(commands.filter((c) => c.includes("npm run lint"))).toHaveLength(2);
    expect(second.steps.map((s) => [s.name, s.status, s.reused])).toEqual([
      ["install", "ok", true],
      ["generate", "ok", undefined],
    ]);
    expect(second.checks[0]!.logPath).toContain("try2-check-1-lint");
  });

  it("runs a step again after it failed", async () => {
    const sandbox = new FakeSandbox();
    let installs = 0;
    sandbox.execHandler = (command) =>
      command.includes("npm ci") && ++installs === 1 ? { exitCode: 1 } : {};
    const tryEnvironment = createTryEnvironment(sandbox);

    expect(
      (await tryEnvironment({ steps: [install], checks: [] })).steps[0]!.status,
    ).toBe("failed");
    expect(
      (await tryEnvironment({ steps: [install], checks: [] })).steps[0]!.status,
    ).toBe("ok");
    expect(installs).toBe(2);
  });
});
