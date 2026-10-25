import type { ProjectResponse } from "@hobai/shared";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { ApiError } from "@/lib/api/client";
import { defaultProjectId, startTaskError, taskReadiness } from "./start-task";

const project = (
  overrides: Partial<ProjectResponse> = {},
): ProjectResponse => ({
  id: "p1",
  repo: { githubId: 1, owner: "ada", name: "dodesk" },
  defaultBranch: "main",
  environment: {
    version: 1,
    health: "ok",
    healthReasons: [],
    savedAt: "2026-10-24T08:00:00.000Z",
  },
  installation: {
    id: 1,
    accountLogin: "ada",
    accountType: "user",
    suspended: false,
    uninstalled: false,
  },
  setup: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  ...overrides,
});

const setUp = { label: "Set up", href: "/projects/p1/environment" };
const rerun = { label: "Re-run setup", href: "/projects/p1/environment" };

describe("taskReadiness", () => {
  it("is ready once set up and healthy", () => {
    expect(taskReadiness(project())).toEqual({ ready: true });
  });

  it.each([
    ["not set up", { environment: null }, "Not set up", setUp],
    [
      "needing attention",
      {
        environment: {
          version: 1,
          health: "needs_attention" as const,
          healthReasons: [],
          savedAt: "2026-10-24T08:00:00.000Z",
        },
      },
      "Needs attention",
      rerun,
    ],
    [
      "with the App suspended",
      {
        installation: {
          id: 1,
          accountLogin: "ada",
          accountType: "user" as const,
          suspended: true,
          uninstalled: false,
        },
      },
      "GitHub App suspended",
      null,
    ],
    [
      "with the App removed",
      {
        environment: null,
        installation: {
          id: 1,
          accountLogin: "ada",
          accountType: "user" as const,
          suspended: false,
          uninstalled: true,
        },
      },
      "GitHub App removed",
      null,
    ],
  ])(
    "says why a project %s can't be picked",
    (_case, overrides, reason, fix) => {
      expect(taskReadiness(project(overrides))).toEqual({
        ready: false,
        reason,
        fix,
      });
    },
  );
});

describe("startTaskError", () => {
  it.each([
    [
      new ApiError(409, "Set up first.", "PROJECT_NOT_SET_UP"),
      { message: "Set up this project before starting a task.", fix: setUp },
    ],
    [
      new ApiError(409, "Needs attention.", "PROJECT_NEEDS_ATTENTION"),
      { message: "This project's setup needs attention.", fix: rerun },
    ],
    [
      new ApiError(
        503,
        `${PRODUCT_NAME} can't take new work right now. Try again in a moment.`,
        "QUEUE_UNAVAILABLE",
      ),
      {
        message:
          `${PRODUCT_NAME} can't take new work right now. Try again in a moment.`,
        fix: null,
      },
    ],
    [
      new Error("boom"),
      { message: "Something went wrong. Try again.", fix: null },
    ],
  ])("explains %s", (error, explained) => {
    expect(startTaskError(error, "p1")).toEqual(explained);
  });
});

describe("defaultProjectId", () => {
  const ready = project({ id: "p1" });
  const other = project({ id: "p2" });
  const notSetUp = project({ id: "p3", environment: null });

  it("takes the first preferred project that's ready", () => {
    expect(defaultProjectId([ready, other], ["p2", "p1"])).toBe("p2");
    expect(defaultProjectId([ready, other, notSetUp], ["p3", null])).toBe("p1");
  });

  it("falls back to the first ready project, or none", () => {
    expect(defaultProjectId([notSetUp, other], [undefined])).toBe("p2");
    expect(defaultProjectId([notSetUp], [])).toBeNull();
  });
});
