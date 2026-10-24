import { describe, expect, it } from "vitest";
import { splitPatch } from "./diff";

const PATCH = [
  "diff --git a/src/routes/index.ts b/src/routes/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/routes/index.ts",
  "+++ b/src/routes/index.ts",
  "@@ -1,3 +1,4 @@",
  ' import { Router } from "express";',
  '+import { health } from "./health.js";',
  ' import { orders } from "./orders.js";',
  '-import { old } from "./old.js";',
  "diff --git a/src/routes/health.ts b/src/routes/health.ts",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/src/routes/health.ts",
  "@@ -0,0 +1,2 @@",
  '+export const health = "ok";',
  "+",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("splitPatch", () => {
  it("splits the diff into each file's numbered lines", () => {
    const files = splitPatch(PATCH);

    expect([...files.keys()]).toEqual([
      "src/routes/index.ts",
      "src/routes/health.ts",
    ]);
    expect(files.get("src/routes/index.ts")).toEqual([
      { kind: "hunk", text: "@@ -1,3 +1,4 @@", number: null },
      { kind: "context", text: 'import { Router } from "express";', number: 1 },
      { kind: "add", text: 'import { health } from "./health.js";', number: 2 },
      {
        kind: "context",
        text: 'import { orders } from "./orders.js";',
        number: 3,
      },
      { kind: "remove", text: 'import { old } from "./old.js";', number: 3 },
    ]);
    expect(files.get("src/routes/health.ts")).toEqual([
      { kind: "hunk", text: "@@ -0,0 +1,2 @@", number: null },
      { kind: "add", text: 'export const health = "ok";', number: 1 },
      { kind: "add", text: "", number: 2 },
    ]);
  });

  it("is empty for an empty patch", () => {
    expect(splitPatch("").size).toBe(0);
  });
});
