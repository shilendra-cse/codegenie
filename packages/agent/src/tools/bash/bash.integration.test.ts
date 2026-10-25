import { afterAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { createToolContext } from "../core/context.js";
import { readFile } from "../read-file/read-file.js";
import { bash } from "./bash.js";

const sandbox = await dockerSandboxOrSkip("bash");

describe.skipIf(!sandbox)("bash against DockerSandbox", () => {
  const ctx = sandbox ? createToolContext(sandbox) : null!;

  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("keeps the command's exit code through the log pipe", async () => {
    expect(await bash(ctx, { command: "echo out; exit 3" })).toBe(
      "Exit code: 3\nout",
    );
  });

  it("merges stdout and stderr in order", async () => {
    expect(await bash(ctx, { command: "echo a; echo b >&2; echo c" })).toBe(
      "Exit code: 0\na\nb\nc",
    );
  });

  it("stops commands that exceed the timeout", async () => {
    const out = await bash(ctx, { command: "sleep 30", timeoutMs: 1000 });
    expect(out).toMatch(/Command timed out after 1s/);
  });

  it("saves the complete output to a log the agent can read", async () => {
    const out = await bash(ctx, { command: "seq 1 200000" });
    expect(out).toMatch(/lines omitted/);
    const logPath = out.match(/saved to (\S+);/)![1]!;
    const count = await sandbox!.exec(`wc -l < ${logPath}`);
    expect(count.stdout.trim()).toBe("200000");
    const tail = await readFile(ctx, { path: logPath, offset: 199_999 });
    expect(tail).toMatch(/199999│ 199999\n200000│ 200000$/);
  });
});
