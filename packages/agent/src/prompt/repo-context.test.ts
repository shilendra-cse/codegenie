import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../tools/core/context.js";
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

  it("summarizes the setup stage, including a failed install", async () => {
    const ctx = createToolContext(new FakeSandbox({ "package.json": "{}" }), [
      { name: "test", command: "npm run test", cwd: "." },
      { name: "test", command: "npm run test", cwd: "web" },
    ]);
    const context = await buildRepoContext(ctx, {
      ecosystem: "node",
      packageManager: "npm",
      install: {
        command: "npm install",
        status: "failed",
        durationMs: 4_200,
        logPath: "/tmp/codegenie/logs/setup-install-retry.log",
        errorTail: "npm ERR! 404 Not Found",
      },
      checks: ctx.checks,
      notes: ["Installing dependencies failed (npm install)."],
    });
    expect(context).toContain(
      [
        "## Setup (done before you started)",
        "Package manager: npm",
        "Install: FAILED (`npm install`). Full output: /tmp/codegenie/logs/setup-install-retry.log",
        "Last lines:",
        "npm ERR! 404 Not Found",
        "Checks (run_checks):",
        "- test: npm run test",
        "- test: npm run test (in web)",
        "Notes:",
        "- Installing dependencies failed (npm install).",
      ].join("\n"),
    );
  });
});
