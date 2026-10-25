import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EnvironmentConfig } from "@hobai/shared";
import { afterAll, describe, expect, it } from "vitest";
import {
  defaultStoreDir,
  EnvironmentFileError,
  FileEnvironmentStore,
  HOME_ENV,
  MAX_VERSIONS,
} from "./file-store.js";

const dirs: string[] = [];
const store = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cg-store-"));
  dirs.push(dir);
  return new FileEnvironmentStore(dir);
};
const config = (command: string): EnvironmentConfig => ({
  version: 1,
  steps: [{ name: "install", cwd: ".", command }],
  checks: [],
  meta: { source: "detected", createdAt: "", decisions: [] },
});
const KEY = "github.com/acme/app";

describe("FileEnvironmentStore", () => {
  afterAll(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it("has nothing for a repository that wasn't set up", async () => {
    const s = store();
    expect(await s.load(KEY)).toBeNull();
    expect(await s.list(KEY)).toEqual([]);
  });

  it("saves numbered versions; the newest is active", async () => {
    const s = store();
    await s.save(KEY, config("npm ci"), "detected");
    const second = await s.save(KEY, config("npm install"), "ai");
    expect(second).toMatchObject({
      repoKey: KEY,
      version: 2,
      source: "ai",
      health: { status: "ok", reasons: [] },
    });
    expect(await s.load(KEY)).toMatchObject({
      version: 2,
      config: { steps: [{ command: "npm install" }] },
    });
    expect((await s.list(KEY)).map((v) => v.version)).toEqual([2, 1]);
    expect(path.basename(s.fileFor(KEY))).toBe("github.com__acme__app.json");
  });

  it(`keeps the last ${MAX_VERSIONS} versions and keeps counting`, async () => {
    const s = store();
    for (let i = 1; i <= MAX_VERSIONS + 1; i++)
      await s.save(KEY, config(`v${i}`), "detected");
    expect((await s.list(KEY)).map((v) => v.version)).toEqual([6, 5, 4, 3, 2]);
  });

  it("marks the active version's health until a new version is saved", async () => {
    const s = store();
    await s.save(KEY, config("npm ci"), "detected");
    await s.markHealth(KEY, "needs_attention", ["admin/ isn't covered."]);
    expect((await s.load(KEY))!.health).toMatchObject({
      status: "needs_attention",
      reasons: ["admin/ isn't covered."],
    });
    await s.save(KEY, config("npm ci"), "ai");
    expect((await s.load(KEY))!.health).toEqual({ status: "ok", reasons: [] });
    await s.markHealth("github.com/acme/other", "needs_attention");
    expect(await s.load("github.com/acme/other")).toBeNull();
  });

  it("names the file when it's broken, and leaves no temporary files", async () => {
    const s = store();
    await s.save(KEY, config("npm ci"), "detected");
    expect(readdirSync(s.dir)).toEqual(["github.com__acme__app.json"]);
    writeFileSync(
      s.fileFor(KEY),
      JSON.stringify({ repoKey: KEY, versions: [{ config: { version: 2 } }] }),
    );
    await expect(s.load(KEY)).rejects.toThrow(EnvironmentFileError);
    await expect(s.load(KEY)).rejects.toThrow(/github\.com__acme__app\.json/);
  });

  it("lives under the home env var when it's set", () => {
    const before = process.env[HOME_ENV];
    process.env[HOME_ENV] = "/tmp/cg-home";
    expect(defaultStoreDir()).toBe("/tmp/cg-home/environments");
    if (before === undefined) delete process.env[HOME_ENV];
    else process.env[HOME_ENV] = before;
  });
});
