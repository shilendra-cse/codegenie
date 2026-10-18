import { describe, expect, it } from "vitest";
import { UsageError } from "./common.js";
import { parseSetupArgs } from "./setup-args.js";

const parse = (...argv: string[]) => parseSetupArgs(argv, "/home/me/code");

describe("parseSetupArgs", () => {
  it("parses a local repo and where to save", () => {
    expect(parse("--repo", "../todo-api", "--save", "env.json")).toEqual({
      help: false,
      source: { type: "local", path: "/home/me/todo-api" },
      savePath: "/home/me/code/env.json",
      model: undefined,
      yes: false,
    });
  });

  it("parses a git URL with a ref, a model and --yes", () => {
    expect(
      parse(
        "--",
        "--repo",
        "https://github.com/acme/app.git",
        "--ref",
        "dev",
        "--save",
        "/tmp/env.json",
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
      savePath: "/tmp/env.json",
      model: "openai:gpt-6-luna",
      yes: true,
    });
  });

  it("returns help", () => {
    expect(parse("--help")).toEqual({ help: true });
  });

  it.each([
    [["--save", "env.json"], /--repo is required/],
    [["--repo", "."], /--save is required/],
    [["--repo", ".", "--save", "e.json", "--ref", "dev"], /--ref only applies/],
    [["--repo", ".", "--save", "e.json", "--task", "x"], /Unknown option/],
  ])("rejects %j", (argv, message) => {
    expect(() => parse(...argv)).toThrow(UsageError);
    expect(() => parse(...argv)).toThrow(message);
  });
});
