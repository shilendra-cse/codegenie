import { describe, expect, it } from "vitest";
import { FakeSandbox } from "../testing/fake-sandbox.js";
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
      { lint: "pnpm lint", test: "pnpm test" },
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
      "## Check commands (used by run_checks)\nlint: pnpm lint\ntest: pnpm test",
    );
  });

  it("skips missing files and reports when no checks are known", async () => {
    const context = await buildRepoContext(
      createToolContext(new FakeSandbox({ "main.go": "" })),
    );
    expect(context).not.toContain("package.json");
    expect(context).not.toContain("README");
    expect(context).toContain(
      "## Check commands (used by run_checks)\nNone detected.",
    );
  });

  it("tolerates an invalid package.json", async () => {
    const context = await buildRepoContext(
      createToolContext(new FakeSandbox({ "package.json": "{ not json" })),
    );
    expect(context).toContain("(package.json could not be parsed)");
  });
});
