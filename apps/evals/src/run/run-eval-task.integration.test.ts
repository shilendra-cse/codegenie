import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scriptedModel } from "@hobai/agent/testing";
import { dockerSandboxOrSkip } from "@hobai/sandbox/testing";
import { afterAll, describe, expect, it } from "vitest";
import { ensureEnvironment } from "../suite/environments.js";
import { loadTasks } from "../suite/tasks.js";
import { runEvalTask } from "./run-eval-task.js";

const probe = await dockerSandboxOrSkip("evals");
await probe?.destroy();
const work = mkdtempSync(path.join(tmpdir(), "cg-evals-"));

const finish = {
  toolCalls: [{ toolName: "finish_task", input: { summary: "Done." } }],
};

describe.skipIf(!probe)("eval harness against DockerSandbox", () => {
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("onboards a fixture, grades a correct fix as solved and an empty one as not", async () => {
    const [task] = await loadTasks({ tasks: ["ts-lib/paginate-bug"] });
    const environment = await ensureEnvironment(task!.repo, {
      model: scriptedModel([]).resolved,
      file: path.join(work, "environment.json"),
      refresh: true,
    });
    expect(environment.checks.map((c) => c.name)).toEqual([
      "typecheck",
      "test",
    ]);
    expect(existsSync(path.join(work, "environment.json"))).toBe(true);

    const fixed = await runEvalTask(task!, {
      attempt: 1,
      environment,
      resultsDir: work,
      model: scriptedModel([
        {
          toolCalls: [
            { toolName: "read_file", input: { path: "src/paginate.ts" } },
          ],
        },
        {
          toolCalls: [
            {
              toolName: "edit_file",
              input: {
                path: "src/paginate.ts",
                oldString: "const start = page * pageSize;",
                newString: "const start = (page - 1) * pageSize;",
              },
            },
          ],
        },
        finish,
      ]).resolved,
    });
    expect(fixed).toMatchObject({
      solved: true,
      grade: { passed: true },
      checks: { regressions: 0 },
      agent: { status: "succeeded" },
    });
    expect(readFileSync(fixed.diffFile!, "utf8")).toContain(
      "(page - 1) * pageSize",
    );

    const untouched = await runEvalTask(task!, {
      attempt: 2,
      environment,
      resultsDir: work,
      model: scriptedModel([finish]).resolved,
    });
    expect(untouched.solved).toBe(false);
    expect(untouched.grade.detail).toMatch(/^Hidden tests failed:/);
    expect(untouched.diffFile).toBeUndefined();
  });
});
