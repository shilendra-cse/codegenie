import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listLocalFiles } from "./local-files.js";

const dirs: string[] = [];

function folder(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "cg-local-"));
  dirs.push(dir);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

function git(dir: string, ...args: string[]) {
  execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("listLocalFiles", () => {
  it("in a git repository, lists tracked and untracked files but not ignored ones", async () => {
    const dir = folder({
      ".gitignore": "node_modules\n.env\ndist\n",
      "src/app.ts": "",
      "src/removed.ts": "",
      ".env": "SECRET=1",
      "dist/out.js": "",
      "node_modules/pkg/index.js": "",
    });
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(
      dir,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-qm",
      "init",
    );
    writeFileSync(path.join(dir, "src/new.ts"), "");
    rmSync(path.join(dir, "src/removed.ts"));

    expect((await listLocalFiles(dir)).sort()).toEqual([
      ".gitignore",
      "src/app.ts",
      "src/new.ts",
    ]);
  });

  it("outside git, lists everything except .git and node_modules", async () => {
    const dir = folder({
      "index.js": "",
      "lib/a.js": "",
      "node_modules/x/i.js": "",
    });
    expect((await listLocalFiles(dir)).sort()).toEqual([
      "index.js",
      "lib/a.js",
    ]);
  });
});
