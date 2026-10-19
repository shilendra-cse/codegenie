import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadTasks } from "./tasks.js";

const dirs: string[] = [];
type TaskSpec = { json: unknown; hidden?: string[] };

function reposDir(
  repos: Record<string, { repo: unknown; tasks: Record<string, TaskSpec> }>,
) {
  const dir = mkdtempSync(path.join(tmpdir(), "cg-repos-"));
  dirs.push(dir);
  for (const [name, { repo, tasks }] of Object.entries(repos)) {
    mkdirSync(path.join(dir, name), { recursive: true });
    writeFileSync(path.join(dir, name, "repo.json"), JSON.stringify(repo));
    for (const [task, { json, hidden = [] }] of Object.entries(tasks)) {
      const taskDir = path.join(dir, name, "tasks", task);
      mkdirSync(path.join(taskDir, "hidden", "nested"), { recursive: true });
      writeFileSync(path.join(taskDir, "task.json"), JSON.stringify(json));
      for (const file of hidden)
        writeFileSync(path.join(taskDir, "hidden", file), "");
    }
  }
  return dir;
}

const hiddenTask = {
  task: "Fix it",
  grader: { type: "hidden-tests", command: "node --test" },
};

describe("loadTasks", () => {
  afterAll(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it("loads the real repositories and their tasks", async () => {
    const tasks = await loadTasks();
    expect(tasks.map((t) => t.id)).toEqual([
      "http-api/health",
      "ts-lib/paginate-bug",
      "ts-lib/rename-fetch-user",
    ]);
    expect(tasks[0]).toMatchObject({
      repo: { name: "http-api", fixture: true },
      hiddenFiles: ["health.test.js"],
    });
  });

  it("fills in grader defaults and lists hidden files in sub-folders", async () => {
    const dir = reposDir({
      app: {
        repo: { fixture: true },
        tasks: {
          fix: {
            json: hiddenTask,
            hidden: ["one.test.ts", "nested/two.test.ts"],
          },
        },
      },
    });
    const [task] = await loadTasks({}, dir);
    expect(task).toMatchObject({
      id: "app/fix",
      grader: { type: "hidden-tests", target: "codegenie-hidden", cwd: "." },
      hiddenFiles: ["nested/two.test.ts", "one.test.ts"],
    });
  });

  it("selects by task or by repository, and rejects unknown ones", async () => {
    const dir = reposDir({
      a: {
        repo: { fixture: true },
        tasks: { one: { json: { ...hiddenTask, grader: { type: "manual" } } } },
      },
      b: {
        repo: { git: "https://github.com/acme/b", commit: "a1b2c3d" },
        tasks: { two: { json: { ...hiddenTask, grader: { type: "manual" } } } },
      },
    });
    expect(
      (await loadTasks({ tasks: ["b/two"] }, dir)).map((t) => t.id),
    ).toEqual(["b/two"]);
    expect((await loadTasks({ repos: ["a"] }, dir)).map((t) => t.id)).toEqual([
      "a/one",
    ]);
    await expect(loadTasks({ tasks: ["a/three"] }, dir)).rejects.toThrow(
      "Unknown task: a/three",
    );
    await expect(loadTasks({ repos: ["c"] }, dir)).rejects.toThrow(
      "Unknown repository: c",
    );
  });

  it("names the repository or task and the problem when something is invalid", async () => {
    const dir = reposDir({
      bad: {
        repo: { git: "https://github.com/acme/r", commit: "main" },
        tasks: {},
      },
      ok: {
        repo: { fixture: true },
        tasks: {
          empty: { json: hiddenTask },
          extra: { json: { ...hiddenTask, repo: "x" } },
        },
      },
    });
    await expect(loadTasks({ repos: ["bad"] }, dir)).rejects.toThrow(
      /Repository bad: commit: a commit SHA/,
    );
    await expect(loadTasks({ repos: ["ok"] }, dir)).rejects.toThrow(
      "Task ok/empty: the hidden-tests grader needs files in hidden/",
    );
  });
});
