import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { createToolContext, createTools } from "./index.js";

describe("createTools", () => {
  it("exposes the eight tools", () => {
    const tools = createTools(createToolContext(new FakeSandbox()));
    expect(Object.keys(tools)).toEqual([
      "list_files",
      "read_file",
      "search",
      "edit_file",
      "write_file",
      "bash",
      "run_checks",
      "finish_task",
    ]);
  });
});
