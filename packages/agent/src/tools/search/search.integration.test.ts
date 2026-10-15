import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dockerSandboxOrSkip } from "../../testing/docker.js";
import { createToolContext } from "../core/context.js";
import { search } from "./search.js";

const sandbox = await dockerSandboxOrSkip("search");

describe.skipIf(!sandbox)("search against DockerSandbox", () => {
  const ctx = sandbox ? createToolContext(sandbox) : null!;

  beforeAll(async () => {
    await sandbox!.writeFile(
      "src/math.ts",
      "export function add(a: number, b: number) {\n  return a + b;\n}\n",
    );
    await sandbox!.writeFile(
      "src/app.ts",
      'import { add } from "./math";\nconsole.log(add(1, 2));\n',
    );
    await sandbox!.writeFile("README.md", "# Demo\nUses Add for sums.\n");
    await sandbox!.writeFile(".gitignore", "node_modules\n");
    await sandbox!.writeFile(
      "node_modules/pkg/index.js",
      "export const x = add(1);\n",
    );
    // ripgrep only applies .gitignore inside a git repository.
    await sandbox!.exec("git init -q");
  });

  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("finds matches with workspace-relative paths, skipping ignored files", async () => {
    const out = await search(ctx, { pattern: "add\\(" });
    expect(out.split("\n").sort()).toEqual([
      "src/app.ts:2:console.log(add(1, 2));",
      "src/math.ts:1:export function add(a: number, b: number) {",
    ]);
  });

  it("filters by glob and supports ignoreCase", async () => {
    expect(await search(ctx, { pattern: "add", glob: "*.md" })).toMatch(
      /^No matches/,
    );
    expect(
      await search(ctx, { pattern: "add", glob: "*.md", ignoreCase: true }),
    ).toBe("README.md:2:Uses Add for sums.");
  });

  it("reports no matches and invalid patterns", async () => {
    expect(await search(ctx, { pattern: "nothing_matches_this" })).toBe(
      'No matches for "nothing_matches_this".',
    );
    await expect(search(ctx, { pattern: "(" })).rejects.toThrow(
      /search failed/,
    );
  });

  it("caps results at 100 matches", async () => {
    await sandbox!.exec(
      "mkdir -p many && for i in $(seq 1 150); do echo needle > many/f$i.txt; done",
    );
    const lines = (
      await search(ctx, { pattern: "needle", path: "many" })
    ).split("\n");
    expect(lines).toHaveLength(101);
    expect(lines.at(-1)).toBe(
      "… 50 more matches. Narrow the search with path or glob.",
    );
  });
});
