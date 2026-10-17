import { describe, expect, it } from "vitest";
import { parseCliArgs, UsageError } from "./args.js";

const parse = (...argv: string[]) => parseCliArgs(argv, "/home/me/code");

describe("parseCliArgs", () => {
  it("parses a local repo and task with defaults", () => {
    expect(parse("--repo", "../todo-api", "--task", "Add /health")).toEqual({
      help: false,
      source: { type: "local", path: "/home/me/todo-api" },
      task: { text: "Add /health" },
      model: undefined,
      limits: {},
      setupOverrides: {},
      environmentPath: undefined,
      saveEnvironmentPath: undefined,
      baselineChecks: true,
      patchPath: undefined,
      keep: false,
      json: false,
    });
  });

  it("parses environment options", () => {
    expect(
      parse(
        "--repo",
        ".",
        "--task",
        "x",
        "--environment",
        "env.json",
        "--save-environment",
        "out/env.json",
        "--no-baseline-checks",
      ),
    ).toMatchObject({
      environmentPath: "/home/me/code/env.json",
      saveEnvironmentPath: "/home/me/code/out/env.json",
      baselineChecks: false,
    });
  });

  it("recognizes git URLs and their ref", () => {
    expect(
      parse(
        "--repo",
        "https://github.com/a/b.git",
        "--ref",
        "dev",
        "--task",
        "x",
      ),
    ).toMatchObject({
      source: { type: "git", url: "https://github.com/a/b.git", ref: "dev" },
    });
    expect(
      parse("--repo", "git@github.com:a/b.git", "--task", "x"),
    ).toMatchObject({
      source: { type: "git" },
    });
  });

  it("parses limits, overrides and output options", () => {
    expect(
      parse(
        "--repo",
        ".",
        "--task-file",
        "task.md",
        "--model",
        "openai:gpt-6-luna",
        "--max-steps",
        "40",
        "--max-cost",
        "0.5",
        "--timeout",
        "10",
        "--install",
        "npm install --legacy-peer-deps",
        "--check",
        "test=npm run test:unit",
        "--check",
        "lint=npm run lint -- --quiet",
        "--patch",
        "out.patch",
        "--keep",
        "--json",
      ),
    ).toEqual({
      help: false,
      source: { type: "local", path: "/home/me/code" },
      task: { file: "/home/me/code/task.md" },
      model: "openai:gpt-6-luna",
      limits: { maxSteps: 40, maxCostUsd: 0.5, maxWallTimeMs: 600_000 },
      setupOverrides: {
        install: "npm install --legacy-peer-deps",
        checks: [
          { name: "test", command: "npm run test:unit", cwd: "." },
          { name: "lint", command: "npm run lint -- --quiet", cwd: "." },
        ],
      },
      environmentPath: undefined,
      saveEnvironmentPath: undefined,
      baselineChecks: true,
      patchPath: "/home/me/code/out.patch",
      keep: true,
      json: true,
    });
  });

  it("supports skipping the install and a leading -- from pnpm", () => {
    expect(
      parse("--", "--repo", ".", "--task", "x", "--no-install"),
    ).toMatchObject({ setupOverrides: { install: false } });
  });

  it("returns help without requiring other flags", () => {
    expect(parse("--help")).toEqual({ help: true });
  });

  it.each([
    [["--task", "x"], /--repo is required/],
    [["--repo", "."], /exactly one of --task or --task-file/],
    [["--repo", ".", "--task", "x", "--task-file", "t"], /exactly one/],
    [
      ["--repo", ".", "--task", "x", "--max-cost", "0"],
      /--max-cost must be a positive number/,
    ],
    [
      ["--repo", ".", "--task", "x", "--check", "deploy=x"],
      /--check name must be one of/,
    ],
    [
      ["--repo", ".", "--task", "x", "--check", "test"],
      /--check expects name=command/,
    ],
    [
      ["--repo", ".", "--task", "x", "--install", "a", "--no-install"],
      /can't be combined/,
    ],
    [
      ["--repo", ".", "--ref", "main", "--task", "x"],
      /--ref only applies to git URLs/,
    ],
    [["--repo", ".", "--task", "x", "--bogus"], /Unknown option/],
    [
      [
        "--repo",
        ".",
        "--task",
        "x",
        "--environment",
        "e.json",
        "--check",
        "test=x",
      ],
      /can't be combined with --environment/,
    ],
  ])("rejects %j", (argv, message) => {
    expect(() => parse(...argv)).toThrow(UsageError);
    expect(() => parse(...argv)).toThrow(message);
  });
});
