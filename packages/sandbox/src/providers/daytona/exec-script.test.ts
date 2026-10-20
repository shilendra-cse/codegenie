import { describe, expect, it } from "vitest";
import { execScript, parseExecOutput } from "./exec-script.js";

// Outputs recorded from a real Daytona sandbox running execScript.
const marker = "__cg_marker_1234__";

describe("parseExecOutput", () => {
  it("splits stdout, exit code and stderr", () => {
    expect(
      parseExecOutput("out-line\n\n__cg_marker_1234__ 7\nerr-line\n", marker),
    ).toEqual({ stdout: "out-line\n", exitCode: 7, stderr: "err-line\n" });
  });

  it("reads the exit code of a command stopped by timeout", () => {
    expect(parseExecOutput("\n__cg_marker_1234__ 124\n", marker)).toEqual({
      stdout: "",
      exitCode: 124,
      stderr: "",
    });
  });

  it("keeps output without a trailing newline intact", () => {
    expect(
      parseExecOutput("no newline\n__cg_marker_1234__ 0\n", marker),
    ).toEqual({ stdout: "no newline", exitCode: 0, stderr: "" });
  });

  it("returns null when the wrapper didn't finish", () => {
    expect(parseExecOutput("bash: mktemp: not found\n", marker)).toBeNull();
  });
});

describe("execScript", () => {
  it("runs the command from the environment, never from the script text", () => {
    const script = execScript(marker, 30);
    expect(script).toContain('bash -lc "$CG_CMD"');
    expect(script).toContain("timeout -k 5s 30s");
    expect(script).toContain(marker);
  });
});
