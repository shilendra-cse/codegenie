import { describe, expect, it } from "vitest";
import { detectChecks } from "./scripts.js";

describe("detectChecks", () => {
  it("maps package.json scripts to checks in a fixed order", () => {
    const checks = detectChecks(
      {
        scripts: {
          build: "tsc -p .",
          test: "vitest run",
          lint: "eslint .",
          typecheck: "tsc --noEmit",
        },
      },
      "pnpm",
      true,
    );
    expect(checks).toEqual([
      { name: "lint", command: "pnpm run lint", cwd: "." },
      { name: "typecheck", command: "pnpm run typecheck", cwd: "." },
      { name: "test", command: "pnpm run test", cwd: "." },
      { name: "build", command: "pnpm run build", cwd: "." },
    ]);
  });

  it("recognizes alternative typecheck script names", () => {
    for (const script of ["type-check", "tsc", "check-types"]) {
      expect(
        detectChecks({ scripts: { [script]: "tsc" } }, "npm", false),
      ).toEqual([
        { name: "typecheck", command: `npm run ${script}`, cwd: "." },
      ]);
    }
  });

  it("falls back to tsc --noEmit for TypeScript repos without a typecheck script", () => {
    const pkg = { devDependencies: { typescript: "^5" } };
    expect(detectChecks(pkg, "npm", true)).toEqual([
      { name: "typecheck", command: "npx --no-install tsc --noEmit", cwd: "." },
    ]);
    expect(detectChecks(pkg, "pnpm", true)[0]!.command).toBe(
      "pnpm exec tsc --noEmit",
    );
    expect(detectChecks(pkg, "yarn", true)[0]!.command).toBe(
      "yarn tsc --noEmit",
    );
  });

  it("does not add the tsc fallback without tsconfig.json or typescript", () => {
    expect(
      detectChecks({ devDependencies: { typescript: "^5" } }, "npm", false),
    ).toEqual([]);
    expect(detectChecks({}, "npm", true)).toEqual([]);
  });

  it("ignores npm's placeholder test script", () => {
    expect(
      detectChecks(
        { scripts: { test: 'echo "Error: no test specified" && exit 1' } },
        "npm",
        false,
      ),
    ).toEqual([]);
  });
});
