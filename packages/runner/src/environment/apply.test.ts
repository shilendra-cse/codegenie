import { SANDBOX_LOG_DIR } from "@hobai/sandbox";
import { FakeSandbox } from "@hobai/sandbox/testing";
import { describe, expect, it } from "vitest";
import { applySteps } from "./apply.js";

function sandboxFailing(...commands: string[]) {
  const sandbox = new FakeSandbox();
  sandbox.execHandler = (command) =>
    commands.some((c) => command.includes(`{ ${c}\n}`))
      ? { exitCode: 1, stdout: "npm ERR! lockfile out of date" }
      : {};
  return sandbox;
}

describe("applySteps", () => {
  it("runs steps in order, each in its own folder", async () => {
    const sandbox = sandboxFailing();
    const results = await applySteps(sandbox, [
      { name: "install api", cwd: "api", command: "npm ci" },
      { name: "install web", cwd: "web", command: "npm ci" },
    ]);
    expect(results.map((r) => [r.name, r.status, r.logPath])).toEqual([
      ["install api", "ok", `${SANDBOX_LOG_DIR}/setup-1-install-api.log`],
      ["install web", "ok", `${SANDBOX_LOG_DIR}/setup-2-install-web.log`],
    ]);
    expect(sandbox.execCalls.map((c) => c.options.cwd)).toEqual(["api", "web"]);
  });

  it("records the alternative that worked", async () => {
    const [result] = await applySteps(sandboxFailing("npm ci"), [
      {
        name: "install",
        cwd: ".",
        command: "npm ci",
        alternatives: ["npm install"],
      },
    ]);
    expect(result).toMatchObject({
      command: "npm install",
      status: "ok",
      logPath: `${SANDBOX_LOG_DIR}/setup-1-install-alt1.log`,
    });
  });

  it("reports a failed step and keeps going", async () => {
    const results = await applySteps(sandboxFailing("npm ci", "npm install"), [
      {
        name: "install",
        cwd: ".",
        command: "npm ci",
        alternatives: ["npm install"],
      },
      { name: "generate", cwd: ".", command: "npx prisma generate" },
    ]);
    expect(results[0]).toMatchObject({
      command: "npm install",
      status: "failed",
      errorTail: "npm ERR! lockfile out of date",
    });
    expect(results[1]).toMatchObject({ name: "generate", status: "ok" });
  });
});
