import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import safePath from "./safe-path.js";

const root = fs.realpathSync(process.cwd());

describe("safePath", () => {
  it("resolves paths inside the project root", () => {
    expect(safePath(".")).toBe(root);
    expect(safePath("src")).toBe(path.join(root, "src"));
  });

  it("rejects parent directory traversal", () => {
    expect(() => safePath("..")).toThrow(/not within the security scope/);
    expect(() => safePath("src/../..")).toThrow(
      /not within the security scope/,
    );
  });

  it("rejects absolute paths outside the project root", () => {
    expect(() => safePath(path.parse(root).root)).toThrow(
      /not within the security scope/,
    );
  });
});
