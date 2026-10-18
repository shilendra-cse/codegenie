import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { RepoReader } from "./repo-reader.js";

describe("RepoReader", () => {
  const repo = () =>
    new RepoReader(
      new FakeSandbox({
        "package.json": '{"name":"x"}',
        "broken.json": "{ nope",
        "src/app.ts": "",
      }),
    );

  it("knows which files and folders are in the root", async () => {
    const reader = repo();
    expect(await reader.hasRootEntry("package.json")).toBe(true);
    expect(await reader.hasRootEntry("src")).toBe(true);
    expect(await reader.hasRootEntry("app.ts")).toBe(false);
    expect(await reader.hasRootEntry("pnpm-lock.yaml")).toBe(false);
  });

  it("reads text, returning null for missing files", async () => {
    expect(await repo().readText("package.json")).toBe('{"name":"x"}');
    expect(await repo().readText("missing.txt")).toBeNull();
  });

  it("reads JSON as ok, missing or invalid", async () => {
    expect(await repo().readJson("package.json")).toEqual({
      status: "ok",
      value: { name: "x" },
    });
    expect(await repo().readJson("nope.json")).toEqual({ status: "missing" });
    expect(await repo().readJson("broken.json")).toMatchObject({
      status: "invalid",
    });
  });
});
