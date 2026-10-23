import { describe, expect, it } from "vitest";
import { buildChecklist, type ChecklistInput } from "./checklist";

const installUrl = "https://github.com/apps/codegenie/installations/new";
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
        projects: [{ id: "p1", environment: null }],
      }),
    ).toEqual(["done", "done", "current", "todo"]);
    expect(
      states({ hasInstallation: true, projects: [{ id: "p1", environment }] }),
    ).toEqual(["done", "done", "done", "current"]);
  });

  it("has nothing current once everything is done", () => {
    expect(
      states({
        hasInstallation: true,
        projects: [{ id: "p1", environment }],
        hasTasks: true,
      }),
    ).toEqual(["done", "done", "done", "done"]);
  });

  it("goes back to installing when the App was removed after a project was added", () => {
    expect(
      states({ projects: [{ id: "p1", environment }], hasTasks: true }),
    ).toEqual(["current", "done", "done", "done"]);
  });

  it("sends set-up to the project that still needs it", () => {
    const steps = buildChecklist({
      installUrl,
      hasInstallation: true,
      projects: [
        { id: "ready", environment },
        { id: "fresh", environment: null },
      ],
      hasTasks: false,
    });

    expect(steps.map((step) => [step.id, step.href])).toEqual([
      ["install", installUrl],
      ["add-repo", "/projects/new"],
      ["set-up", "/projects/fresh/environment"],
      ["first-task", "/new"],
    ]);
  });
});
