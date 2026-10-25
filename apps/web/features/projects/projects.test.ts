import type { ProjectResponse } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { toSidebarProject } from "./projects";

const project = (
  environment: ProjectResponse["environment"],
): ProjectResponse => ({
  id: "p1",
  repo: { githubId: 1, owner: "ada", name: "dodesk" },
  defaultBranch: "main",
  environment,
  installation: { accountLogin: "ada", suspended: false, uninstalled: false },
  setup: null,
  createdAt: "2026-10-23T08:00:00.000Z",
});

const environment = (health: "ok" | "needs_attention") => ({
  version: 1,
  health,
  healthReasons: [],
  savedAt: "2026-10-23T08:00:00.000Z",
});

describe("toSidebarProject", () => {
  it.each([
    ["not set up", null, "none"],
    ["ready", environment("ok"), "ok"],
    ["needing attention", environment("needs_attention"), "attention"],
  ] as const)("shows a project %s", (_case, env, health) => {
    expect(toSidebarProject(project(env))).toEqual({
      id: "p1",
      name: "dodesk",
      health,
    });
  });
});
