import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { postComponents } from "./post-components";

vi.mock("@/features/devlog/assets", () => ({
  devlogAssetUrl: (slug: string, file: string) =>
    `/devlog-assets/${slug}/${file}`,
}));

const Figure = postComponents("a-post").Figure as ComponentType<
  Record<string, unknown>
>;

const props = {
  src: "flow.svg",
  alt: "A repository going into a sandbox",
  width: 1200,
  height: 480,
};

describe("postComponents", () => {
  it("points a Figure at the post's assets", () => {
    render(<Figure {...props} darkSrc="flow-dark.svg" />);

    const [light, dark] = screen.getAllByRole("img", { name: props.alt });
    expect(light).toHaveAttribute("src", "/devlog-assets/a-post/flow.svg");
    expect(dark).toHaveAttribute("src", "/devlog-assets/a-post/flow-dark.svg");
  });

  it.each([
    ["without alt text", { ...props, alt: undefined }, "alt"],
    ["without a size", { ...props, width: undefined }, "width"],
    ["with a prop it doesn't know", { ...props, title: "x" }, "title"],
  ])("refuses a Figure %s, naming the post", (_, figure, field) => {
    expect(() => render(<Figure {...figure} />)).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          new RegExp(`^a-post\\.mdx: <Figure>:[\\s\\S]*${field}`),
        ),
      }),
    );
  });
});
