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

  it("knows which files and folders exist, in the root and in folders", async () => {
    const reader = repo();
    expect(await reader.has("package.json")).toBe(true);
    expect(await reader.has("src")).toBe(true);
    expect(await reader.has("src/app.ts")).toBe(true);
    expect(await reader.has("app.ts")).toBe(false);
    expect(await reader.has("pnpm-lock.yaml")).toBe(false);
  });

  it("lists a folder's entries, empty when it doesn't exist", async () => {
    const reader = repo();
    expect(await reader.entries()).toContainEqual({
      name: "src",
      isDirectory: true,
    });
    expect(await reader.entries("src")).toEqual([
      { name: "app.ts", isDirectory: false },
    ]);
    expect(await reader.entries("missing")).toEqual([]);
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
