import type { DeliverableRun } from "@hobai/runner";
import { describe, expect, it } from "vitest";
import { DOMAIN, PRODUCT_NAME } from "@hobai/shared/brand";
import { commitMessage, isDraft, pullRequestBody } from "./pull-request.js";

function run(overrides: {
  status?: "succeeded" | "incomplete";
  passed?: boolean | null;
  summary?: string | null;
  files?: number;
}): DeliverableRun {
  const passed = overrides.passed === undefined ? true : overrides.passed;
  return {
    agent: {
      status: overrides.status ?? "succeeded",
      summary:
        overrides.summary === undefined
          ? "Added GET /health."
          : overrides.summary,
      limitReached: overrides.status === "incomplete" ? "steps" : undefined,
    },
    verify: {
      passed,
      fixed: 0,
      regressions: passed === false ? 1 : 0,
      checks:
        passed === null
          ? []
          : [
              {
                name: "lint",
                cwd: ".",
                command: "npm run lint",
                status: "passing",
                comparison: "passing",
              },
              {
                name: "test",
                cwd: "api",
                command: "npm test",
                status: passed ? "passing" : "failing",
                comparison: passed ? "fixed" : "regressed",
              },
            ],
    },
    diff: {
      patch: "",
      truncated: false,
      files: Array.from({ length: overrides.files ?? 2 }, (_, i) =>
        i === 1
          ? { path: "logo.png", added: null, removed: null }
          : { path: `src/file-${i}.ts`, added: 3, removed: 1 },
      ),
    },
  } as unknown as DeliverableRun;
}

describe("isDraft", () => {
  it("is a draft when checks failed or the run is incomplete", () => {
    expect(isDraft(run({}))).toBe(false);
    expect(isDraft(run({ passed: null }))).toBe(false);
    expect(isDraft(run({ passed: false }))).toBe(true);
    expect(isDraft(run({ status: "incomplete" }))).toBe(true);
  });
});

describe("commitMessage", () => {
  it("uses the title as the subject and the summary as the body", () => {
    expect(commitMessage("Add a /health endpoint", "Added it.\n")).toBe(
      "Add a /health endpoint\n\nAdded it.",
    );
    expect(commitMessage("Fix it\nmore detail", null)).toBe("Fix it");
    expect(commitMessage("x".repeat(100), null)).toBe(`${"x".repeat(71)}…`);
  });
});

describe("pullRequestBody", () => {
  it("has the summary, the checks and the changed files", () => {
    expect(pullRequestBody(run({}))).toBe(
      [
        "Added GET /health.",
        "### Checks\n\n| Check | Command | Result |\n|---|---|---|\n| lint | `npm run lint` | ✅ passing |\n| test (`api`) | `npm test` | ✅ fixed |",
        "### Changed files\n\n- `src/file-0.ts` (+3 −1)\n- `logo.png` (binary)",
        `<sub>Opened by ${PRODUCT_NAME}.</sub>`,
      ].join("\n\n"),
    );
  });

  it("says when the run is incomplete, checks broke or drafts aren't available", () => {
    const body = pullRequestBody(
      run({ status: "incomplete", passed: false, summary: null, files: 53 }),
      { draftUnavailable: true },
    );
    expect(body).toContain("the agent stopped at its steps limit");
    expect(body).toContain("draft pull requests aren't available");
    expect(body).toContain("_The agent didn't leave a summary._");
    expect(body).toContain(
      "| test (`api`) | `npm test` | ❌ broken by this change |",
    );
    expect(body).toContain("- …and 3 more");
  });

  it(`links to the task when ${PRODUCT_NAME}'s address is known`, () => {
    const taskUrl = `https://${DOMAIN}/tasks/t1`;
    expect(
      pullRequestBody(run({}), { taskUrl }).endsWith(
        `\n\n<sub>Opened by ${PRODUCT_NAME} · [View the task](${taskUrl})</sub>`,
      ),
    ).toBe(true);
  });

  it("says when there are no checks", () => {
    expect(pullRequestBody(run({ passed: null }))).toContain(
      "No checks are set up for this repository.",
    );
  });
});
