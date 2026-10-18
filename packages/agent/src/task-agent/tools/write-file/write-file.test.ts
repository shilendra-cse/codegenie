import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext } from "../../../tools/core/context.js";
import { editFile } from "../edit-file/edit-file.js";
import { readFile } from "../../../tools/read-file/read-file.js";
import { writeFile } from "./write-file.js";

describe("write_file", () => {
  it("creates new files without a prior read", async () => {
    const sandbox = new FakeSandbox();
    const ctx = createToolContext(sandbox);
    expect(
      await writeFile(ctx, { path: "src/new.ts", content: "a\nb\n" }),
    ).toBe("Created src/new.ts (2 lines).");
    expect(sandbox.files.get("/workspace/src/new.ts")).toBe("a\nb\n");
  });

  it("requires reading an existing file before overwriting it", async () => {
    const ctx = createToolContext(new FakeSandbox({ "a.ts": "old\n" }));
    await expect(
      writeFile(ctx, { path: "a.ts", content: "new\n" }),
    ).rejects.toThrow(/already exists/);
    await readFile(ctx, { path: "a.ts" });
    expect(await writeFile(ctx, { path: "a.ts", content: "new\n" })).toBe(
      "Overwrote a.ts (1 line).",
    );
  });

  it("allows editing a file it just created", async () => {
    const ctx = createToolContext(new FakeSandbox());
    await writeFile(ctx, { path: "a.ts", content: "one\n" });
    expect(
      await editFile(ctx, { path: "a.ts", oldString: "one", newString: "two" }),
    ).toMatch(/^Edited a\.ts/);
  });
});
