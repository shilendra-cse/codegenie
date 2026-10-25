import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { gitAuthEnv } from "../../lib/git-auth.js";
import { checkoutRepo } from "./checkout.js";

const sandbox = await dockerSandboxOrSkip("checkout");
const token = "ghs_test0123456789abcdefghijklmnopqrstuv";

describe.skipIf(!sandbox)("checkoutRepo with a token, in Docker", () => {
  afterAll(() => sandbox?.destroy());

  it("lets git use the token for that one command", async () => {
    const withToken = await sandbox!.exec("git config --get http.extraHeader", {
      env: gitAuthEnv(token),
    });
    const without = await sandbox!.exec("git config --get http.extraHeader");

    expect(withToken.stdout).toContain("AUTHORIZATION: basic ");
    expect(without.stdout).toBe("");
  });

  it("leaves no trace of the token in the clone", async () => {
    await sandbox!.exec(
      [
        "mkdir -p /tmp/origin && cd /tmp/origin && git init -q",
        "echo hi > README.md && git add -A && git commit -qm init",
        "git clone -q --bare /tmp/origin /tmp/origin.git",
      ].join(" && "),
    );

    await checkoutRepo(sandbox!, {
      type: "git",
      url: "file:///tmp/origin.git",
      token,
    });

    const remote = await sandbox!.exec("git remote get-url origin");
    const traces = await sandbox!.exec(
      `grep -rl -e '${token}' -e 'AUTHORIZATION' -e 'extraHeader' .git || true`,
    );
    expect(await sandbox!.readFile("README.md")).toBe("hi\n");
    expect(remote.stdout.trim()).toBe("file:///tmp/origin.git");
    expect(traces.stdout).toBe("");
  });
});
