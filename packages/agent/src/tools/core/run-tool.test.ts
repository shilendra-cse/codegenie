import { SandboxFileError, SandboxGoneError } from "@codegenie/sandbox";
import { describe, expect, it } from "vitest";
import { runTool } from "./run-tool.js";
import { ToolError } from "./tool-error.js";

describe("runTool", () => {
  it("returns expected failures to the model as text", async () => {
    expect(
      await runTool(async () => {
        throw new ToolError("bad input");
      }),
    ).toBe("Error: bad input");
    expect(
      await runTool(async () => {
        throw new SandboxFileError("cat: x: No such file", "x");
      }),
    ).toBe("Error: cat: x: No such file");
  });

  it("rethrows infrastructure errors so the run can stop", async () => {
    await expect(
      runTool(async () => {
        throw new SandboxGoneError("gone");
      }),
    ).rejects.toBeInstanceOf(SandboxGoneError);
  });

  it("caps any result at 30,000 characters", async () => {
    const out = await runTool(async () => "x\n".repeat(50_000));
    expect(out.length).toBeLessThanOrEqual(30_100);
  });
});
