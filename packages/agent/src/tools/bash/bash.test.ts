import { describe, expect, it } from "vitest";
import { FakeSandbox } from "../../testing/fake-sandbox.js";
import { createToolContext } from "../core/context.js";
import { LOG_DIR } from "../core/workspace-path.js";
import { bash } from "./bash.js";

describe("bash", () => {
  it("runs the command with its output also saved to a numbered log", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ stdout: "hello\n" });

    expect(
      await bash(createToolContext(sandbox), { command: "echo hello" }),
    ).toBe("Exit code: 0\nhello");
    const sent = sandbox.execCalls[0]!.command;
    expect(sent).toContain("set -o pipefail");
    expect(sent).toContain("{ echo hello\n} 2>&1 | tee");
    expect(sent).toContain(`${LOG_DIR}/0001-bash.log`);
  });

  it("reports timeouts and passes the timeout through", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({ exitCode: 124, timedOut: true });
    const out = await bash(createToolContext(sandbox), {
      command: "sleep 99",
      timeoutMs: 5000,
    });
    expect(out).toBe(
      "Exit code: 124\nCommand timed out after 5s and was stopped.\n(no output)",
    );
    expect(sandbox.execCalls[0]!.options.timeoutMs).toBe(5000);
  });

  it("shortens long output and points to the full log", async () => {
    const sandbox = new FakeSandbox();
    const big = Array.from({ length: 20_000 }, (_, i) => `line ${i}`).join(
      "\n",
    );
    sandbox.execHandler = (command) =>
      command.startsWith("wc -c") ? { stdout: "2400000\n" } : { stdout: big };
    const out = await bash(createToolContext(sandbox), { command: "seq" });
    expect(out.length).toBeLessThan(30_000);
    expect(out).toMatch(/lines omitted/);
    expect(out).toMatch(
      /Full output \(2\.3 MB\) saved to \/tmp\/codegenie\/logs\/0001-bash\.log/,
    );
  });
});
