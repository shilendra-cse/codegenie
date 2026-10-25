import type { StoredEnvironment } from "@hobai/shared";
import { plain } from "@hobai/terminal";
import { describe, expect, it } from "vitest";
import {
  describeSaved,
  healthWarning,
  missingEnvironment,
  versionLine,
} from "./saved-environment.js";

const stored = (
  overrides: Partial<StoredEnvironment> = {},
): StoredEnvironment => ({
  repoKey: "github.com/acme/app",
  version: 3,
  source: "ai",
  savedAt: "2026-10-19T10:12:30.000Z",
  config: {
    version: 1,
    steps: [
      { name: "install", cwd: "web", command: "npm ci" },
      { name: "install", cwd: "api", command: "npm ci" },
    ],
    checks: [
      { name: "lint", cwd: "web", command: "npm run lint" },
      { name: "test", cwd: ".", command: "npm test" },
    ],
    meta: {
      source: "ai",
      createdAt: "",
      decisions: [{ question: "Lint the api?", answer: "No", auto: true }],
    },
  },
  health: { status: "ok", reasons: [] },
  ...overrides,
});

describe("saved environment output", () => {
  it("names the version in use", () => {
    expect(versionLine(stored())).toBe(
      "version 3 · ai · saved 2026-10-19 10:12",
    );
  });

  it("tells how to set up a repository that has no environment", () => {
    expect(
      missingEnvironment(plain, "github.com/acme/app", {
        type: "git",
        url: "https://github.com/acme/app",
      }),
    ).toBe(
      "✗ No environment for github.com/acme/app yet.\n  Set the repository up first: pnpm agent:setup --repo https://github.com/acme/app",
    );
  });

  it("warns with the reasons when the environment needs attention", () => {
    expect(healthWarning(plain, stored())).toEqual([]);
    expect(
      healthWarning(
        plain,
        stored({
          health: {
            status: "needs_attention",
            reasons: ["admin/ isn't covered."],
          },
        }),
      ),
    ).toEqual([
      "│ ⚠ The environment needs attention:",
      "│   - admin/ isn't covered.",
      "│   Run pnpm agent:setup again to update it.",
    ]);
  });

  it("describes the active version for --show", () => {
    expect(
      describeSaved(
        plain,
        "github.com/acme/app",
        [stored(), stored({ version: 2 })],
        "/home/me/.hobai/environments/x.json",
      ),
    ).toBe(
      [
        "◆ github.com/acme/app",
        "│ Version 3 (active) · ai · saved 2026-10-19 10:12 · 1 older version",
        "│ Health: ✓ ok",
        "│ Steps:  install (web): npm ci · install (api): npm ci",
        "│ Checks: lint (web) · test",
        "│ Answers:",
        "│   - Lint the api? → No (automatic)",
        "└ /home/me/.hobai/environments/x.json",
      ].join("\n"),
    );
    expect(
      describeSaved(plain, "github.com/acme/app", [], "/x.json"),
    ).toBeNull();
  });
});
