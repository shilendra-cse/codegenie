import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../core/context.js";
import { listFiles } from "./list-files.js";

function setup(files: Record<string, string> = {}) {
  return createToolContext(new FakeSandbox(files));
}

describe("list_files", () => {
  it("renders a tree, skipping node_modules and .git", async () => {
    const ctx = setup({
      "package.json": "{}",
      "src/app.ts": "",
      "src/routes/todos.ts": "",
      "node_modules/x/index.js": "",
      ".git/HEAD": "",
    });
    expect(await listFiles(ctx, {})).toBe(
      "./\n  package.json\n  src/\n    app.ts\n    routes/",
    );
  });

  it("lists a subfolder with more depth", async () => {
    const ctx = setup({ "src/routes/todos.ts": "" });
    expect(await listFiles(ctx, { path: "src", depth: 3 })).toBe(
      "src/\n  routes/\n    todos.ts",
    );
  });

  it("reports an empty folder", async () => {
    expect(await listFiles(setup(), { path: "empty" })).toBe("empty/\n(empty)");
  });
});
