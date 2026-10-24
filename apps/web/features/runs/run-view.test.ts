import type { RunEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { buildRunView } from "./run-view";

type Body = RunEvent extends infer T
  ? T extends unknown
    ? Omit<T, "runId" | "ts" | "seq">
    : never
  : never;

const at = (second: number) =>
  new Date(Date.UTC(2026, 9, 24, 10, 0, second)).toISOString();

/** Events one second apart, numbered from 1. */
function run(...bodies: Body[]): RunEvent[] {
  return bodies.map(
    (body, index) =>
      ({ ...body, runId: "r1", seq: index + 1, ts: at(index) }) as RunEvent,
  );
}

const start = (id: string, toolName: string, input: unknown): Body => ({
  type: "tool_start",
  toolCallId: id,
  toolName,
  input,
});
const end = (id: string, toolName: string, output: unknown): Body => ({
  type: "tool_end",
  toolCallId: id,
  toolName,
  output,
});

describe("buildRunView", () => {
  it("has every stage pending before anything happened", () => {
    expect(buildRunView([]).stages.map((s) => [s.id, s.state])).toEqual([
      ["prepare", "pending"],
      ["setup", "pending"],
      ["working", "pending"],
      ["checks", "pending"],
      ["pr", "pending"],
    ]);
  });

  it("moves through the stages with when each started and ended", () => {
    const view = buildRunView(
      run(
        { type: "stage_changed", stage: "prepare" },
        { type: "sandbox_created", sandboxId: "sb" },
        { type: "stage_changed", stage: "checkout" },
        { type: "stage_changed", stage: "setup" },
        { type: "stage_changed", stage: "agent" },
      ),
    );

    expect(view.stages.slice(0, 3)).toEqual([
      { id: "prepare", state: "done", startedAt: at(0), endedAt: at(3) },
      { id: "setup", state: "done", startedAt: at(3), endedAt: at(4) },
      { id: "working", state: "running", startedAt: at(4), endedAt: null },
    ]);
    expect(view.stages[3]!.state).toBe("pending");
  });

  it.each([
    ["succeeded", "done"],
    ["failed", "failed"],
    ["cancelled", "stopped"],
  ] as const)(
    "ends the current stage when the run %s, skipping the rest",
    (status, state) => {
      const view = buildRunView(
        run(
          { type: "stage_changed", stage: "prepare" },
          { type: "stage_changed", stage: "agent" },
          { type: "done", status },
        ),
      );
      expect(view.stages.map((s) => s.state)).toEqual([
        "done",
        "skipped",
        state,
        "skipped",
        "skipped",
      ]);
      expect(view.status).toBe(status);
    },
  );

  it("folds reads, searches and listings in a row into one group", () => {
    const view = buildRunView(
      run(
        start("t1", "read_file", { path: "src/app.ts" }),
        end("t1", "read_file", "…"),
        start("t2", "search", { pattern: "checkDatabase" }),
        end("t2", "search", "…"),
        start("t3", "list_files", { path: "src" }),
        start("t4", "bash", { command: "pnpm test" }),
        start("t5", "read_file", { path: "src/db.ts" }),
      ),
    );

    expect(view.activity.map((a) => a.kind)).toEqual([
      "explored",
      "command",
      "explored",
    ]);
    expect(view.activity[0]).toMatchObject({
      reads: 1,
      searches: 1,
      listings: 1,
      running: true,
      items: [
        { tool: "read_file", target: "src/app.ts", running: false },
        { tool: "search", target: "checkDatabase", running: false },
        { tool: "list_files", target: "src", running: true },
      ],
    });
  });

  it("counts each edit's lines, and adds them up per file", () => {
    const view = buildRunView(
      run(
        start("e1", "write_file", {
          path: "src/health.ts",
          content: "a\nb\nc\n",
        }),
        end("e1", "write_file", "Wrote src/health.ts"),
        start("e2", "edit_file", {
          path: "src/app.ts",
          oldString: "x",
          newString: "x\ny",
        }),
        end("e2", "edit_file", "Edited src/app.ts (1 replacement)."),
        start("e3", "edit_file", {
          path: "src/app.ts",
          oldString: "old\nlines",
          newString: "new",
        }),
        end("e3", "edit_file", "Edited src/app.ts (1 replacement)."),
        start("e4", "edit_file", {
          path: "src/gone.ts",
          oldString: "a",
          newString: "b",
        }),
        end("e4", "edit_file", "Error: src/gone.ts doesn't exist"),
      ),
    );

    expect(view.activity[0]).toMatchObject({
      kind: "edit",
      path: "src/health.ts",
      whole: true,
      added: 3,
      removed: 0,
    });
    expect(view.activity[2]).toMatchObject({ kind: "edit", failed: true });
    expect(view.files).toEqual([
      { path: "src/health.ts", added: 3, removed: 0 },
      { path: "src/app.ts", added: 3, removed: 3 },
    ]);
  });

  it("folds consecutive edits to one file into one row", () => {
    const view = buildRunView(
      run(
        start("e1", "write_file", { path: "src/a.ts", content: "a\nb\n" }),
        end("e1", "write_file", "Wrote src/a.ts"),
        start("e2", "edit_file", {
          path: "src/a.ts",
          oldString: "b",
          newString: "c\nd",
        }),
        end("e2", "edit_file", "Edited src/a.ts (1 replacement)."),
        start("e3", "edit_file", {
          path: "src/a.ts",
          oldString: "z",
          newString: "y",
        }),
        end("e3", "edit_file", "Error: oldString not found in src/a.ts"),
        start("e4", "edit_file", {
          path: "src/b.ts",
          oldString: "x",
          newString: "y",
        }),
        end("e4", "edit_file", "Edited src/b.ts (1 replacement)."),
        start("c1", "bash", { command: "pnpm test" }),
        end("c1", "bash", "Exit code: 0\nok"),
        start("e5", "edit_file", {
          path: "src/b.ts",
          oldString: "y",
          newString: "w",
        }),
      ),
    );

    expect(view.activity).toMatchObject([
      {
        id: "e1",
        kind: "edit",
        path: "src/a.ts",
        whole: true,
        added: 4,
        removed: 1,
        edits: 2,
        running: false,
        failed: false,
      },
      { kind: "edit", path: "src/b.ts", edits: 1 },
      { kind: "command" },
      { kind: "edit", path: "src/b.ts", edits: 0, running: true },
    ]);
  });

  it("marks a row failed only when all of its edits failed", () => {
    const view = buildRunView(
      run(
        start("e1", "edit_file", {
          path: "src/a.ts",
          oldString: "x",
          newString: "y",
        }),
        end("e1", "edit_file", "Error: oldString not found in src/a.ts"),
        start("e2", "edit_file", {
          path: "src/a.ts",
          oldString: "q",
          newString: "r",
        }),
      ),
    );

    expect(view.activity).toMatchObject([
      { kind: "edit", running: true, failed: false, edits: 0 },
    ]);

    const ended = buildRunView(
      run(
        start("e1", "edit_file", {
          path: "src/a.ts",
          oldString: "x",
          newString: "y",
        }),
        end("e1", "edit_file", "Error: oldString not found in src/a.ts"),
        start("e2", "edit_file", {
          path: "src/a.ts",
          oldString: "q",
          newString: "r",
        }),
        end("e2", "edit_file", "Error: oldString not found in src/a.ts"),
      ),
    );
    expect(ended.activity).toMatchObject([
      { kind: "edit", running: false, failed: true, edits: 0, added: 0 },
    ]);
    expect(ended.files).toEqual([]);
  });

  it("keeps each command with its exit code and output, marked when cut short", () => {
    const view = buildRunView(
      run(
        start("c1", "bash", { command: "pnpm test" }),
        end(
          "c1",
          "bash",
          "Exit code: 1\n1 failed | 22 passed… [5120 more characters]",
        ),
        start("c2", "bash", { command: "pnpm lint" }),
        end("c2", "bash", "Exit code: 0\n(no output)"),
        start("c3", "bash", { command: "pnpm build" }),
      ),
    );

    expect(view.commands).toEqual([
      {
        id: "c1",
        command: "pnpm test",
        output: "1 failed | 22 passed… [5120 more characters]",
        exitCode: 1,
        running: false,
        cutShort: true,
      },
      {
        id: "c2",
        command: "pnpm lint",
        output: "(no output)",
        exitCode: 0,
        running: false,
        cutShort: false,
      },
      {
        id: "c3",
        command: "pnpm build",
        output: null,
        exitCode: null,
        running: true,
        cutShort: false,
      },
    ]);
    expect(view.activity.map((a) => a.failed)).toEqual([true, false, false]);
  });

  it("counts the agent's own check runs, and leaves out its finish", () => {
    const view = buildRunView(
      run(
        start("k1", "run_checks", {}),
        end(
          "k1",
          "run_checks",
          "✓ lint: passing in 2.0s — pnpm lint\n✗ test: failing in 6.2s — pnpm test\nSome checks fail.",
        ),
        start("f1", "finish_task", { summary: "Done." }),
      ),
    );
    expect(view.activity).toEqual([
      expect.objectContaining({ kind: "checks", passing: 1, failing: 1 }),
    ]);
  });

  it("shows each check before and after the agent's work", () => {
    const view = buildRunView(
      run(
        {
          type: "setup_completed",
          success: true,
          steps: [{ name: "install", cwd: ".", status: "ok" }],
          checks: [
            { name: "lint", cwd: ".", command: "pnpm lint", status: "passing" },
            {
              name: "test",
              cwd: "api",
              command: "pnpm test",
              status: "failing",
            },
          ],
        },
        {
          type: "checks_completed",
          passed: false,
          checks: [
            {
              name: "lint",
              cwd: ".",
              command: "pnpm lint",
              status: "failing",
              comparison: "regressed",
            },
            {
              name: "test",
              cwd: "api",
              command: "pnpm test",
              status: "passing",
              comparison: "fixed",
            },
          ],
        },
      ),
    );

    expect(view.setupOk).toBe(true);
    expect(view.checksDone).toBe(true);
    expect(view.checksPassed).toBe(false);
    expect(view.checks).toEqual([
      {
        name: "lint",
        cwd: ".",
        command: "pnpm lint",
        before: "passing",
        after: "failing",
        comparison: "regressed",
      },
      {
        name: "test",
        cwd: "api",
        command: "pnpm test",
        before: "failing",
        after: "passing",
        comparison: "fixed",
      },
    ]);
  });

  it("has the checks before the agent's work until they run again", () => {
    const view = buildRunView(
      run({
        type: "setup_completed",
        success: true,
        steps: [],
        checks: [{ name: "test", cwd: ".", status: "passing" }],
      }),
    );
    expect(view.checksDone).toBe(false);
    expect(view.checks).toEqual([
      {
        name: "test",
        cwd: ".",
        command: null,
        before: "passing",
        after: null,
        comparison: null,
      },
    ]);
  });

  it("picks up the title, the branch, the pull request and the error", () => {
    const view = buildRunView(
      run(
        { type: "task_titled", title: "Add a health check" },
        {
          type: "branch_created",
          branchName: "codegenie/add-a-health-check-1a2b",
        },
        {
          type: "pr_opened",
          prNumber: 7,
          prUrl: "https://github.com/acme/app/pull/7",
          draft: true,
        },
        { type: "error", code: "deliver_failed", message: "GitHub said no." },
      ),
    );
    expect(view).toMatchObject({
      title: "Add a health check",
      branch: "codegenie/add-a-health-check-1a2b",
      pullRequest: {
        number: 7,
        url: "https://github.com/acme/app/pull/7",
        draft: true,
      },
      error: "GitHub said no.",
    });
  });
});
