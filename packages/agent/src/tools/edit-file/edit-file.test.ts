import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../core/context.js";
import { ToolError } from "../core/tool-error.js";
import { readFile } from "../read-file/read-file.js";
import { editFile } from "./edit-file.js";

const file = 'import a from "a";\n\nexport function f() {\n  return 1;\n}\n';

async function readThenEdit(
  files: Record<string, string>,
  edit: Parameters<typeof editFile>[1],
) {
  const sandbox = new FakeSandbox(files);
  const ctx = createToolContext(sandbox);
  await readFile(ctx, { path: edit.path });
  const out = await editFile(ctx, edit);
  return { sandbox, out };
}

describe("edit_file", () => {
  it("replaces a unique match and shows the edited lines in context", async () => {
    const { sandbox, out } = await readThenEdit(
      { "f.ts": file },
      { path: "f.ts", oldString: "  return 1;", newString: "  return 2;" },
    );
    expect(sandbox.files.get("/workspace/f.ts")).toBe(
      file.replace("return 1", "return 2"),
    );
    expect(out).toBe(
      "Edited f.ts (1 replacement).\n2│ \n3│ export function f() {\n4│   return 2;\n5│ }",
    );
  });

  it("refuses to edit a file that wasn't read first", async () => {
    const ctx = createToolContext(new FakeSandbox({ "f.ts": file }));
    await expect(
      editFile(ctx, { path: "f.ts", oldString: "return 1", newString: "x" }),
    ).rejects.toThrow(/Read f\.ts with read_file first/);
  });

  it("reports no match with guidance", async () => {
    await expect(
      readThenEdit(
        { "f.ts": file },
        { path: "f.ts", oldString: "return 3", newString: "x" },
      ),
    ).rejects.toThrow(/not found in f\.ts/);
  });

  it("refuses ambiguous matches unless replaceAll is set", async () => {
    const files = { "f.ts": "x = 1;\ny = 1;\n" };
    await expect(
      readThenEdit(files, { path: "f.ts", oldString: "1;", newString: "2;" }),
    ).rejects.toThrow(/matches 2 places/);

    const { sandbox, out } = await readThenEdit(files, {
      path: "f.ts",
      oldString: "1;",
      newString: "2;",
      replaceAll: true,
    });
    expect(sandbox.files.get("/workspace/f.ts")).toBe("x = 2;\ny = 2;\n");
    expect(out).toMatch(/^Edited f\.ts \(2 replacements\)/);
  });

  it("rejects empty or no-op edits", async () => {
    await expect(
      readThenEdit(
        { "f.ts": file },
        { path: "f.ts", oldString: "", newString: "x" },
      ),
    ).rejects.toThrow(/oldString is empty/);
    await expect(
      readThenEdit(
        { "f.ts": file },
        { path: "f.ts", oldString: "return 1", newString: "return 1" },
      ),
    ).rejects.toThrow(/identical/);
  });

  it("inserts replacement text literally, even with $ patterns", async () => {
    const { sandbox } = await readThenEdit(
      { "f.ts": "price = X;\n" },
      { path: "f.ts", oldString: "X", newString: "'$&$1'" },
    );
    expect(sandbox.files.get("/workspace/f.ts")).toBe("price = '$&$1';\n");
  });

  it("refuses edits inside .git", async () => {
    const ctx = createToolContext(new FakeSandbox({ ".git/config": "x" }));
    await expect(
      editFile(ctx, { path: ".git/config", oldString: "x", newString: "y" }),
    ).rejects.toThrow(ToolError);
  });
});
