import { describe, expect, it } from "vitest";
import { parseEvalArgs, UsageError } from "./args.js";

describe("parseEvalArgs", () => {
  it("defaults to every task once, two at a time", () => {
    expect(parseEvalArgs([])).toEqual({
      help: false,
      tasks: [],
      repos: [],
      repeat: 1,
      concurrency: 2,
      onboard: false,
      model: undefined,
    });
  });

  it("parses tasks, repeats, concurrency, onboarding and the model", () => {
    expect(
      parseEvalArgs([
        "--",
        "--task",
        "a",
        "--task",
        "b",
        "--repo",
        "dodesk",
        "--repeat",
        "3",
        "--concurrency",
        "1",
        "--onboard",
        "--model",
        "openai:gpt-6-luna",
      ]),
    ).toEqual({
      help: false,
      tasks: ["a", "b"],
      repos: ["dodesk"],
      repeat: 3,
      concurrency: 1,
      onboard: true,
      model: "openai:gpt-6-luna",
    });
  });

  it.each([["--repeat", "0"], ["--concurrency", "1.5"], ["--nope"]])(
    "rejects %s %s",
    (...argv) => {
      expect(() => parseEvalArgs(argv)).toThrow(UsageError);
    },
  );
});
