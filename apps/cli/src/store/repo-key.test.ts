import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { keyFromUrl, repoKey } from "./repo-key.js";

const dirs: string[] = [];
const tempDir = () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cg-key-")));
  dirs.push(dir);
  return dir;
};
const git = (dir: string, ...args: string[]) =>
  execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });

describe("keyFromUrl", () => {
  it.each([
    "https://github.com/Shilendra-cse/BuyerBook.git",
    "https://github.com/shilendra-cse/buyerbook",
    "https://github.com/shilendra-cse/buyerbook/",
    "git@github.com:shilendra-cse/BuyerBook.git",
    "ssh://git@github.com/shilendra-cse/BuyerBook.git",
    "ssh://git@github.com:22/shilendra-cse/BuyerBook",
  ])("%s", (url) => {
    expect(keyFromUrl(url)).toBe("github.com/shilendra-cse/buyerbook");
  });

  it("returns null for something that isn't a repository URL", () => {
    expect(keyFromUrl("just-a-folder")).toBeNull();
  });
});

describe("repoKey", () => {
  afterAll(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it("keys git URLs by host and path", async () => {
    expect(
      await repoKey({ type: "git", url: "git@github.com:Acme/App.git" }),
    ).toBe("github.com/acme/app");
  });

  it("keys a local clone by its origin, like its URL", async () => {
    const dir = tempDir();
    git(dir, "init", "-q");
    git(dir, "remote", "add", "origin", "https://github.com/Acme/App.git");
    expect(await repoKey({ type: "local", path: dir })).toBe(
      "github.com/acme/app",
    );
  });

  it("keys folders without a remote, or inside another repository, by path", async () => {
    const plain = tempDir();
    expect(await repoKey({ type: "local", path: plain })).toBe(
      `local:${plain}`,
    );

    const outer = tempDir();
    git(outer, "init", "-q");
    git(outer, "remote", "add", "origin", "https://github.com/acme/monorepo");
    const inner = path.join(outer, "fixtures", "app");
    mkdirSync(inner, { recursive: true });
    expect(await repoKey({ type: "local", path: inner })).toBe(
      `local:${inner}`,
    );
  });
});
