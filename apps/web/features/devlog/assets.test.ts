import path from "node:path";
import { describe, expect, it } from "vitest";
import { devlogAssetUrl } from "./assets";

const PUBLIC = path.join(import.meta.dirname, "__fixtures__/public");

describe("devlogAssetUrl", () => {
  it("gives the address of a file in the post's folder", () => {
    expect(devlogAssetUrl("sample-post", "diagram.svg", PUBLIC)).toBe(
      "/devlog-assets/sample-post/diagram.svg",
    );
  });

  it("names the post when the file doesn't exist", () => {
    expect(() => devlogAssetUrl("sample-post", "missing.png", PUBLIC)).toThrow(
      "sample-post.mdx: /devlog-assets/sample-post/missing.png doesn't exist in public/",
    );
  });

  it.each(["../other-post/diagram.svg", "nested/diagram.svg", ".hidden"])(
    "refuses %s, which isn't a file name in the post's folder",
    (file) => {
      expect(() => devlogAssetUrl("sample-post", file, PUBLIC)).toThrow(
        "must be a file name in /devlog-assets/sample-post/",
      );
    },
  );
});
