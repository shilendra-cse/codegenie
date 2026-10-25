import type { ProjectResponse } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { isSettingUp, toSidebarProject } from "./projects";

const project = (
  environment: ProjectResponse["environment"],
): ProjectResponse => ({
  id: "p1",
  repo: { githubId: 1, owner: "ada", name: "dodesk" },
  defaultBranch: "main",
  environment,
  installation: {
    id: 1,
    accountLogin: "ada",
    accountType: "user",
    suspended: false,
    uninstalled: false,
  },
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

describe("isSettingUp", () => {
  it.each([
    ["queued", true],
    ["running", true],
    ["waiting", true],
    ["succeeded", false],
    ["failed", false],
    ["cancelled", false],
  ] as const)("treats a %s setup as in progress: %s", (status, expected) => {
    expect(isSettingUp({ ...project(null), setup: { id: "s1", status } })).toBe(
      expected,
    );
  });

  it("is false before any setup", () => {
    expect(isSettingUp(project(null))).toBe(false);
  });
});
