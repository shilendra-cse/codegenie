import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { CheckoutError, checkoutRepo } from "./checkout.js";

describe("checkoutRepo", () => {
  it("shallow-clones git URLs, with an optional branch", async () => {
    const sandbox = new FakeSandbox();
    expect(
      await checkoutRepo(sandbox, {
        type: "git",
        url: "https://github.com/acme/app.git",
        ref: "main",
      }),
    ).toEqual({
      description: "https://github.com/acme/app.git (main)",
      files: null,
    });
    expect(sandbox.execCalls[0]!.command).toBe(
      "git clone --quiet --depth 1 --branch 'main' 'https://github.com/acme/app.git' .",
    );
  });

  it("gives a token to the clone through its environment only", async () => {
    const sandbox = new FakeSandbox();
    await checkoutRepo(sandbox, {
      type: "git",
      url: "https://github.com/acme/private.git",
      token: "ghs_secret",
    });

    const { command, options } = sandbox.execCalls[0]!;
    expect(command).toBe(
      "git clone --quiet --depth 1 'https://github.com/acme/private.git' .",
    );
    expect(options.env).toEqual({
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.extraHeader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from("x-access-token:ghs_secret").toString("base64")}`,
    });
  });

  it("reports clone failures", async () => {
    const sandbox = new FakeSandbox();
    sandbox.execHandler = () => ({
      exitCode: 128,
      stderr: "fatal: repository not found",
    });
    await expect(
      checkoutRepo(sandbox, { type: "git", url: "https://github.com/x/y" }),
    ).rejects.toThrow(/git clone failed: fatal: repository not found/);
  });

  it("only copies local folders into Docker sandboxes", async () => {
    await expect(
      checkoutRepo(new FakeSandbox(), { type: "local", path: "." }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });
});
