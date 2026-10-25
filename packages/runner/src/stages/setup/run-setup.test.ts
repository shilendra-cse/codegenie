import { FakeSandbox } from "@hobai/sandbox/testing";
import type { EnvironmentConfig, RunEvent } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { SHORT_NAME } from "@hobai/shared/brand";
import { runSetup } from "./run-setup.js";

const repo = {
  "package.json": JSON.stringify({
    scripts: { lint: "eslint .", test: "vitest run", build: "tsc" },
  }),
  "package-lock.json": "{}",
};

function sandbox(handler: (command: string) => object = () => ({})) {
  const fake = new FakeSandbox(repo);
  fake.execHandler = (command) => {
    if (command.includes("git rev-parse HEAD") && !command.includes("commit")) {
      return { stdout: "c0ffee\n" };
    }
    if (command.includes("git rev-parse HEAD")) return { stdout: "base1\n" };
    return handler(command);
  };
  return fake;
}

function run(
  fake: FakeSandbox,
  extra: Partial<Parameters<typeof runSetup>[1]> = {},
) {
  const events: RunEvent[] = [];
  const result = runSetup(fake, {
    runId: "run-1",
    emit: (e) => events.push(e),
    baselineChecks: true,
    ...extra,
  });
  return { result, events };
}

describe("runSetup", () => {
  it("drafts, applies, runs the baseline and builds a config from what worked", async () => {
    const fake = sandbox((command) =>
      command.includes("{ npm ci\n}")
        ? { exitCode: 1 }
        : command.includes("npm run build")
          ? { exitCode: 127, stdout: "tsc: command not found" }
          : command.includes("npm run test")
            ? { exitCode: 1, stdout: "1 failing" }
            : {},
    );
    const { result, events } = run(fake);
    const { setup, gitBase } = await result;

    expect(gitBase).toBe("base1");
    expect(setup.steps).toMatchObject([
      { command: "npm install", status: "ok" },
    ]);
    expect(setup.baseline?.map((c) => [c.name, c.status])).toEqual([
      ["lint", "passing"],
      ["test", "failing"],
      ["build", "broken"],
    ]);
    expect(setup.checks.map((c) => c.name)).toEqual(["lint", "test"]);
    expect(setup.health).toBe("ok");
    expect(setup.notes).toContain(
      'Check "build" (.) removed: the command could not run (`npm run build`).',
    );
    expect(setup.config).toMatchObject({
      version: 1,
      steps: [{ name: "install", cwd: ".", command: "npm install" }],
      checks: [{ name: "lint" }, { name: "test" }],
      meta: {
        source: "detected",
        commit: "c0ffee",
        validation: {
          steps: { "install@.": "ok" },
          checks: {
            "lint@.": "passing",
            "test@.": "failing",
            "build@.": "broken",
          },
        },
      },
    });
    expect(events.map((e) => e.type)).toEqual([
      "setup_started",
      "setup_completed",
    ]);
    expect(events[1]).toMatchObject({
      success: true,
      steps: [{ name: "install", cwd: ".", status: "ok" }],
      checks: [
        { name: "lint", cwd: ".", status: "passing" },
        { name: "test", cwd: ".", status: "failing" },
        { name: "build", cwd: ".", status: "broken" },
      ],
    });
  });

  it("takes the baseline commit after the checks, so their files belong to the baseline", async () => {
    const fake = sandbox();
    await run(fake).result;
    const commands = fake.execCalls.map((c) => c.command);
    const lastCheck = commands
      .map((c) => c.includes("npm run "))
      .lastIndexOf(true);
    const commit = commands.findIndex((c) =>
      c.includes(`${SHORT_NAME}: baseline`),
    );
    expect(lastCheck).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(lastCheck);
  });

  it("replays a given config without detecting anything", async () => {
    const environment: EnvironmentConfig = {
      version: 1,
      steps: [{ name: "install", cwd: "api", command: "pnpm install" }],
      checks: [{ name: "test", cwd: "api", command: "pnpm test" }],
      meta: { source: "user", createdAt: "", decisions: [] },
    };
    const fake = sandbox();
    const { setup } = await run(fake, { environment }).result;

    expect(setup.config).toBe(environment);
    expect(setup.notes).toEqual([]);
    expect(setup).toMatchObject({
      health: "needs_attention",
      healthReasons: [
        "The repository root has its own package.json but isn't covered by the environment.",
      ],
    });
    expect(fake.execCalls.some((c) => c.command.includes("npm ci"))).toBe(
      false,
    );
    expect(
      fake.execCalls.find((c) => c.command.includes("pnpm install"))!.options
        .cwd,
    ).toBe("api");
  });

  it("skips the baseline when asked and keeps every check", async () => {
    const { setup } = await run(sandbox(), {
      baselineChecks: false,
    }).result;
    expect(setup.baseline).toBeNull();
    expect(setup.checks.map((c) => c.name)).toEqual(["lint", "test", "build"]);
  });

  it("flags the environment when a step fails", async () => {
    const { setup } = await run(
      sandbox((command) =>
        command.includes("{ npm ci\n}") || command.includes("{ npm install\n}")
          ? { exitCode: 1 }
          : {},
      ),
    ).result;
    expect(setup.health).toBe("needs_attention");
    expect(
      setup.notes.some((n) => n.startsWith('Setup step "install" (.) failed')),
    ).toBe(true);
  });
});
