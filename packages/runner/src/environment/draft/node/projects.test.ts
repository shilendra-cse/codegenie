import { describe, expect, it } from "vitest";
import { parsePnpmWorkspace } from "./projects.js";

describe("parsePnpmWorkspace", () => {
  it("reads the packages list in its common forms", () => {
    expect(
      parsePnpmWorkspace(
        "packages:\n  - 'apps/*'\n  - \"lib\"\n  - tools/* # comment\n  - '!**/test/**'\ncatalog:\n  - nope\n",
      ),
    ).toEqual(["apps/*", "lib", "tools/*", "!**/test/**"]);
  });

  it("returns nothing without a packages list", () => {
    expect(parsePnpmWorkspace("onlyBuiltDependencies:\n  - esbuild\n")).toEqual(
      [],
    );
  });
});
