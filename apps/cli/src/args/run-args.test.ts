import { describe, expect, it } from "vitest";
import { UsageError } from "./common.js";
import { parseCliArgs } from "./run-args.js";

const parse = (...argv: string[]) => parseCliArgs(argv, "/home/me/code");

describe("parseCliArgs", () => {
  it("parses a local repo and task with defaults", () => {
    expect(parse("--repo", "../todo-api", "--task", "Add /health")).toEqual({
      help: false,
      source: { type: "local", path: "/home/me/todo-api" },
      task: { text: "Add /health" },
      model: undefined,
      limits: {},
      environmentPath: undefined,
      baselineChecks: true,
      patchPath: undefined,
      keep: false,
      json: false,
    });
  });

  it("takes an explicit environment file and skipping the baseline", () => {
    expect(
      parse(
        "--repo",
        ".",
        "--task",
        "x",
        "--environment",
        "env.json",
        "--no-baseline-checks",
      ),
    ).toMatchObject({
      environmentPath: "/home/me/code/env.json",
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

  it("parses limits and output options, after a leading -- from pnpm", () => {
    expect(
      parse(
        "--",
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
      environmentPath: undefined,
      baselineChecks: true,
      patchPath: "/home/me/code/out.patch",
      keep: true,
      json: true,
    });
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
      ["--repo", ".", "--ref", "main", "--task", "x"],
      /--ref only applies to git URLs/,
    ],
    [["--repo", ".", "--task", "x", "--bogus"], /Unknown option/],
    [
      ["--repo", ".", "--task", "x", "--install", "npm i"],
      /Unknown option '--install'/,
    ],
    [
      ["--repo", ".", "--task", "x", "--no-install"],
      /Unknown option '--no-install'/,
    ],
    [
      ["--repo", ".", "--task", "x", "--check", "test=x"],
      /Unknown option '--check'/,
    ],
    [
      ["--repo", ".", "--task", "x", "--save-environment", "e.json"],
      /Unknown option/,
    ],
  ])("rejects %j", (argv, message) => {
    expect(() => parse(...argv)).toThrow(UsageError);
    expect(() => parse(...argv)).toThrow(message);
  });
});
