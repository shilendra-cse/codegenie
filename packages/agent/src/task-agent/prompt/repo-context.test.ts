import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../../tools/core/context.js";
import { buildRepoContext } from "./repo-context.js";

describe("buildRepoContext", () => {
  it("summarizes the tree, package.json, README, AGENTS.md and check commands", async () => {
    const readme = Array.from(
      { length: 100 },
      (_, i) => `readme line ${i + 1}`,
    ).join("\n");
    const ctx = createToolContext(
      new FakeSandbox({
        "package.json": JSON.stringify({
          name: "todo-api",
          scripts: { test: "vitest run", lint: "eslint ." },
          dependencies: { express: "^5" },
          devDependencies: { vitest: "^3" },
        }),
        "README.md": readme,
        "AGENTS.md": "Use pnpm. Tests live next to the code.",
        "src/app.ts": "",
      }),
      [
        { name: "lint", command: "pnpm lint", cwd: "." },
        { name: "test", command: "pnpm test", cwd: "." },
      ],
    );

    const context = await buildRepoContext(ctx);
    expect(context).toContain(
      "## Files (2 levels)\n./\n  AGENTS.md\n  package.json\n  README.md\n  src/\n    app.ts",
    );
    expect(context).toContain(
      "## package.json\nname: todo-api\nscripts:\n  test: vitest run\n  lint: eslint .\ndependencies: express\ndevDependencies: vitest",
    );
    expect(context).toContain(
      "readme line 80\n… (20 more lines; read README.md for the rest)",
    );
    expect(context).not.toContain("readme line 81");
    expect(context).toContain(
      "## AGENTS.md (instructions from the repository owners)\nUse pnpm.",
    );
    expect(context).toContain(
      "## Setup (done before you started)\nChecks (run_checks):\n- lint: pnpm lint\n- test: pnpm test",
    );
  });

  it("skips missing files and reports when no checks are known", async () => {
    const context = await buildRepoContext(
      createToolContext(new FakeSandbox({ "main.go": "" })),
    );
    expect(context).not.toContain("package.json");
    expect(context).not.toContain("README");
    expect(context).toContain(
      "## Setup (done before you started)\nChecks (run_checks): none detected.",
    );
  });

  it("tolerates an invalid package.json", async () => {
    const context = await buildRepoContext(
      createToolContext(new FakeSandbox({ "package.json": "{ not json" })),
    );
    expect(context).toContain("(package.json could not be parsed)");
  });

  it("summarizes setup steps, baseline statuses and notes", async () => {
    const ctx = createToolContext(new FakeSandbox({ "package.json": "{}" }), [
      { name: "lint", command: "npm run lint", cwd: "." },
      { name: "test", command: "npm run test", cwd: "web" },
    ]);
    const context = await buildRepoContext(ctx, {
      config: {
        version: 1,
        steps: [],
        checks: ctx.checks,
        meta: { source: "detected", createdAt: "", decisions: [] },
      },
      steps: [
        {
          name: "install",
          cwd: ".",
          command: "npm ci",
          status: "ok",
          durationMs: 1,
          logPath: "/l1",
        },
        {
          name: "install",
          cwd: "web",
          command: "npm install",
          status: "failed",
          durationMs: 1,
          logPath: "/tmp/codegenie/logs/setup-2-install.log",
          errorTail: "npm ERR! 404 Not Found",
        },
      ],
      baseline: [
        {
          name: "lint",
          command: "npm run lint",
          cwd: ".",
          status: "passing",
          durationMs: 1,
          logPath: "/b1",
        },
        {
          name: "test",
          command: "npm run test",
          cwd: "web",
          status: "failing",
          durationMs: 1,
          logPath: "/b2",
        },
      ],
      checks: ctx.checks,
      health: "needs_attention",
      healthReasons: [],
      notes: ['Setup step "install" (web) failed: `npm install`.'],
    });
    expect(context).toContain(
      [
        "## Setup (done before you started)",
        "Steps:",
        "- install: `npm ci` ✓",
        "- install (in web): `npm install` FAILED. Full output: /tmp/codegenie/logs/setup-2-install.log",
        "  Last lines:",
        "npm ERR! 404 Not Found",
        "Checks (run_checks) and their status before your changes:",
        "- lint: npm run lint (passing)",
        "- test (in web): npm run test (already failing)",
        "Notes:",
        '- Setup step "install" (web) failed: `npm install`.',
        "Don't try to fix checks that were already failing unless the task asks for it.",
      ].join("\n"),
    );
  });
});
