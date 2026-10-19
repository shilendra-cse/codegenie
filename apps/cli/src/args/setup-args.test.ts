import { describe, expect, it } from "vitest";
import { UsageError } from "./common.js";
import { parseSetupArgs } from "./setup-args.js";

const parse = (...argv: string[]) => parseSetupArgs(argv, "/home/me/code");

describe("parseSetupArgs", () => {
  it("only needs the repository", () => {
    expect(parse("--repo", "../todo-api")).toEqual({
      help: false,
      source: { type: "local", path: "/home/me/todo-api" },
      savePath: undefined,
      model: undefined,
      yes: false,
      show: false,
    });
  });

  it("parses a git URL with a ref, a copy to save, a model and --yes", () => {
    expect(
      parse(
        "--",
        "--repo",
        "https://github.com/acme/app.git",
        "--ref",
        "dev",
        "--save",
        "env.json",
        "--model",
        "openai:gpt-6-luna",
        "--yes",
      ),
    ).toMatchObject({
      source: {
        type: "git",
        url: "https://github.com/acme/app.git",
        ref: "dev",
      },
      savePath: "/home/me/code/env.json",
      model: "openai:gpt-6-luna",
      yes: true,
      show: false,
    });
  });

  it("shows the saved environment", () => {
    expect(parse("--repo", ".", "--show")).toMatchObject({ show: true });
  });

  it("returns help", () => {
    expect(parse("--help")).toEqual({ help: true });
  });

  it.each([
    [["--show"], /--repo is required/],
    [["--repo", ".", "--ref", "dev"], /--ref only applies/],
    [["--repo", ".", "--task", "x"], /Unknown option/],
    [
      ["--repo", ".", "--show", "--yes"],
      /--show only shows the saved environment/,
    ],
  ])("rejects %j", (argv, message) => {
    expect(() => parse(...argv)).toThrow(UsageError);
    expect(() => parse(...argv)).toThrow(message);
  });
});
