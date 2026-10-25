import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { shellQuote } from "../../lib/shell-quote.js";
import { collectDiff, createBaseline } from "../changes/index.js";
import { checkoutRepo } from "../checkout/index.js";
import { blobSha, listChanges, snapshotChanges } from "./change-set.js";

const sandbox = await dockerSandboxOrSkip("change set");
const ODD_NAME = "docs/it's a\nnew line.md";

async function run(command: string) {
  const result = await sandbox!.exec(command);
  if (result.exitCode !== 0) throw new Error(`${command}: ${result.stderr}`);
  return result.stdout;
}

describe.skipIf(!sandbox)("listChanges in Docker", () => {
  afterAll(() => sandbox?.destroy());

  it("lists exactly the agent's changes, on the checked-out commit", async () => {
    await run(
      [
        "mkdir -p /tmp/origin && cd /tmp/origin && git init -q",
        "mkdir -p src scripts",
        "echo 'export const a = 1;' > src/app.js",
        "echo 'echo build' > scripts/build.sh",
        "echo '{}' > package-lock.json",
        "echo gone > src/old.js && echo moved > src/before.js",
        "git add -A && git commit -qm init",
        "git clone -q --bare /tmp/origin /tmp/origin.git",
      ].join(" && "),
    );
    await checkoutRepo(sandbox!, {
      type: "git",
      url: "file:///tmp/origin.git",
    });
    const cloned = (await run("git rev-parse HEAD")).trim();

    await run(
      "echo '{\"setup\":1}' > package-lock.json && mkdir -p dist && echo built > dist/out.js",
    );
    const baseline = await createBaseline(sandbox!);

    await run(
      [
        "echo 'export const a = 2;' > src/app.js",
        "chmod +x scripts/build.sh",
        'echo \'{"setup":1,"agent":1}\' > package-lock.json',
        "head -c 2500000 /dev/urandom > logo.bin",
        "rm src/old.js && git mv -f src/before.js src/after.js",
        "ln -s src/app.js current.js",
        `mkdir -p docs && echo odd > ${shellQuote(ODD_NAME)}`,
      ].join(" && "),
    );
    await collectDiff(sandbox!, baseline);
    const snapshot = await snapshotChanges(sandbox!);
    await run("echo report > check-output.txt");

    const changes = await listChanges(sandbox!, baseline, snapshot);

    expect(changes.parent).toBe(cloned);
    expect(changes.writes.map(({ path, mode }) => [path, mode]).sort()).toEqual(
      [
        ["current.js", "120000"],
        [ODD_NAME, "100644"],
        ["logo.bin", "100644"],
        ["package-lock.json", "100644"],
        ["scripts/build.sh", "100755"],
        ["src/after.js", "100644"],
        ["src/app.js", "100644"],
      ].sort(),
    );
    expect(changes.deletions.sort()).toEqual(["src/before.js", "src/old.js"]);

    const logo = changes.writes.find((f) => f.path === "logo.bin")!;
    const content = await changes.readFile(logo);
    expect(content.length).toBe(2_500_000);
    expect(blobSha(content)).toBe(logo.sha);
    const link = changes.writes.find((f) => f.path === "current.js")!;
    expect((await changes.readFile(link)).toString()).toBe("src/app.js");

    const commit = (
      await run(`git commit-tree ${changes.tree} -p ${changes.parent} -m test`)
    ).trim();
    expect(
      (await run(`git diff --name-status --no-renames ${cloned} ${commit}`))
        .trim()
        .split("\n")
        .sort(),
    ).toEqual(
      [
        "A\tcurrent.js",
        `A\t"docs/it's a\\nnew line.md"`,
        "A\tlogo.bin",
        "M\tpackage-lock.json",
        "M\tscripts/build.sh",
        "A\tsrc/after.js",
        "M\tsrc/app.js",
        "D\tsrc/before.js",
        "D\tsrc/old.js",
      ].sort(),
    );
    expect(await run(`git show ${commit}:package-lock.json`)).toBe(
      '{"setup":1,"agent":1}\n',
    );
  });
});
