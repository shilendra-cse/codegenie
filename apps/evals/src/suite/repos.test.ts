import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FakeSandbox } from "@hobai/sandbox/testing";
import type { EnvironmentConfig } from "@hobai/shared";
import { afterAll, describe, expect, it } from "vitest";
import { madeForOtherCommit } from "./environments.js";
import { loadRepo, pinCommit, repoSource, type EvalRepo } from "./repos.js";

const pinned: EvalRepo = {
  name: "dodesk",
  dir: "/evals/repos/dodesk",
  git: "https://github.com/shilendra-cse/DoDesk",
  commit: "a1b2c3d4e5f6",
};
const fixture: EvalRepo = {
  name: "ts-lib",
  dir: "/evals/repos/ts-lib",
  fixture: true,
};
const work = mkdtempSync(path.join(tmpdir(), "cg-repo-"));

describe("repos", () => {
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("reads repo.json and names the repository after its folder", async () => {
    mkdirSync(path.join(work, "dodesk"));
    writeFileSync(
      path.join(work, "dodesk", "repo.json"),
      JSON.stringify({ git: pinned.git, commit: pinned.commit }),
    );
    expect(await loadRepo(path.join(work, "dodesk"))).toEqual({
      ...pinned,
      dir: path.join(work, "dodesk"),
    });
    await expect(loadRepo(path.join(work, "missing"))).rejects.toThrow(
      /Repository missing: can't read repo.json/,
    );
  });

  it("checks fixtures out from source/ and real repositories by URL", () => {
    expect(repoSource(fixture)).toEqual({
      type: "local",
      path: "/evals/repos/ts-lib/source",
    });
    expect(repoSource(pinned)).toEqual({ type: "git", url: pinned.git });
  });

  it("moves a clone to the pinned commit, and fails clearly when it can't", async () => {
    const sandbox = new FakeSandbox();
    await pinCommit(sandbox, pinned);
    expect(sandbox.execCalls[0]!.command).toBe(
      "git fetch --quiet --depth 1 origin a1b2c3d4e5f6 && git checkout --quiet a1b2c3d4e5f6",
    );
    sandbox.execHandler = () => ({ exitCode: 128, stderr: "not our ref" });
    await expect(pinCommit(sandbox, pinned)).rejects.toThrow(
      "Could not check out commit a1b2c3d4e5f6: not our ref",
    );
    const untouched = new FakeSandbox();
    await pinCommit(untouched, fixture);
    expect(untouched.execCalls).toEqual([]);
  });

  it("treats an environment made at another commit as stale", () => {
    const made = (commit?: string) =>
      ({ meta: { commit } }) as unknown as EnvironmentConfig;
    expect(madeForOtherCommit(made("a1b2c3d4e5f6aaaa"), pinned)).toBe(false);
    expect(madeForOtherCommit(made("ffff0000"), pinned)).toBe(true);
    expect(madeForOtherCommit(made(undefined), pinned)).toBe(true);
    expect(madeForOtherCommit(made(undefined), fixture)).toBe(false);
  });
});
