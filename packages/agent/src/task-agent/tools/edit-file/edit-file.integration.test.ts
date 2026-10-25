import { afterAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { createToolContext } from "../../../tools/core/context.js";
import { readFile } from "../../../tools/read-file/read-file.js";
import { editFile } from "./edit-file.js";

const sandbox = await dockerSandboxOrSkip("edit_file");

describe.skipIf(!sandbox)("edit_file against DockerSandbox", () => {
  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("read_file then edit_file changes the real file", async () => {
    const ctx = createToolContext(sandbox!);
    await sandbox!.writeFile(
      "src/math.ts",
      "export function add(a: number, b: number) {\n  return a + b;\n}\n",
    );
    await readFile(ctx, { path: "src/math.ts" });
    await editFile(ctx, {
      path: "src/math.ts",
      oldString: "return a + b;",
      newString: "return a + b + 0;",
    });
    expect(await sandbox!.readFile("src/math.ts")).toContain(
      "return a + b + 0;",
    );
  });
});
