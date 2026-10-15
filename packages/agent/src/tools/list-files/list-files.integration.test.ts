import { afterAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "../../testing/docker.js";
import { createToolContext } from "../core/context.js";
import { listFiles } from "./list-files.js";

const sandbox = await dockerSandboxOrSkip("list_files");

describe.skipIf(!sandbox)("list_files against DockerSandbox", () => {
  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("shows the real tree", async () => {
    await sandbox!.writeFile("src/app.ts", "");
    await sandbox!.writeFile("src/math.ts", "");
    await sandbox!.writeFile("src/node_modules/pkg/index.js", "");
    const out = await listFiles(createToolContext(sandbox!), { path: "src" });
    expect(out).toBe("src/\n  app.ts\n  math.ts");
  });
});
