import { describe, expect, it } from "vitest";
import { buildChecklist, type ChecklistInput } from "./checklist";

const installUrl = "https://github.com/apps/hobai/installations/new";
const project = (
  id: string,
  env: ChecklistInput["projects"][number]["environment"],
) => ({ id, repo: { githubId: 1, owner: "ada", name: id }, environment: env });

const environment = {
  version: 1,
  health: "ok" as const,
  healthReasons: [],
  savedAt: "2026-10-23T08:00:00.000Z",
};

function states(input: Partial<ChecklistInput>) {
  return buildChecklist({
    installUrl,
    hasInstallation: false,
    projects: [],
    hasTasks: false,
    ...input,
  }).map((step) => step.state);
}

describe("buildChecklist", () => {
  it("starts a new user at installing the GitHub App", () => {
    const [install] = buildChecklist({
      installUrl,
      hasInstallation: false,
      projects: [],
      hasTasks: false,
    });

    expect(states({})).toEqual(["current", "todo", "todo", "todo"]);
    expect(install).toMatchObject({ href: installUrl, external: true });
  });

  it("moves on as each step is done", () => {
    expect(states({ hasInstallation: true })).toEqual([
      "done",
      "current",
      "todo",
      "todo",
    ]);
    expect(
      states({
        hasInstallation: true,
        projects: [project("p1", null)],
      }),
    ).toEqual(["done", "done", "current", "todo"]);
    expect(
      states({ hasInstallation: true, projects: [project("p1", environment)] }),
    ).toEqual(["done", "done", "done", "current"]);
  });

  it("has nothing current once everything is done", () => {
    expect(
      states({
        hasInstallation: true,
        projects: [project("p1", environment)],
        hasTasks: true,
      }),
    ).toEqual(["done", "done", "done", "done"]);
  });

  it("goes back to installing when the App was removed after a project was added", () => {
    expect(
      states({ projects: [project("p1", environment)], hasTasks: true }),
    ).toEqual(["current", "done", "done", "done"]);
  });

  it("sends set-up to the project that still needs it", () => {
    const steps = buildChecklist({
      installUrl,
      hasInstallation: true,
      projects: [project("ready", environment), project("fresh", null)],
      hasTasks: false,
    });

    expect(steps.map((step) => [step.id, step.href])).toEqual([
      ["install", installUrl],
      ["add-repo", "/projects/new"],
      ["set-up", "/projects/fresh/environment"],
      ["first-task", "/new?project=ready"],
    ]);
    expect(steps[3]).toMatchObject({
      projectId: "ready",
      projectName: "ready",
    });
  });

  it("names the project the repository and setup steps are about", () => {
    const steps = buildChecklist({
      installUrl,
      hasInstallation: true,
      projects: [project("dodesk", null)],
      hasTasks: false,
    });

    expect(steps[1]).toMatchObject({ state: "done", projectName: "dodesk" });
    expect(steps[2]).toMatchObject({
      state: "current",
      projectName: "dodesk",
      projectId: "dodesk",
    });
    expect(steps[0].projectName).toBeUndefined();
  });
});
