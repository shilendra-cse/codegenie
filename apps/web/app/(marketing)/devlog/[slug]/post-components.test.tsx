import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { postComponents } from "./post-components";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
vi.mock("@/features/devlog/assets", () => ({
  devlogAssetUrl: (slug: string, file: string) =>
    `/devlog-assets/${slug}/${file}`,
}));

const components = postComponents("a-post");
const Figure = components.Figure as ComponentType<Record<string, unknown>>;
const Artifact = components.Artifact as ComponentType<Record<string, unknown>>;

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

  it("points an Artifact at the post's assets, in the site's theme", () => {
    render(<Artifact src="run.html" title="Run lifecycle" height={520} />);

    expect(screen.getByTitle("Run lifecycle")).toHaveAttribute(
      "src",
      "/devlog-assets/a-post/run.html?theme=dark",
    );
  });

  it.each([
    ["that isn't HTML", { src: "run.png", title: "Run", height: 520 }, "html"],
    ["without a title", { src: "run.html", height: 520 }, "title"],
    ["without a height", { src: "run.html", title: "Run" }, "height"],
    [
      "taller than 2000 px",
      { src: "run.html", title: "Run", height: 5000 },
      "height",
    ],
  ])("refuses an Artifact %s, naming the post", (_, artifact, field) => {
    expect(() => render(<Artifact {...artifact} />)).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          new RegExp(`^a-post\\.mdx: <Artifact>:[\\s\\S]*${field}`),
        ),
      }),
    );
  });
});
