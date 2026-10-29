import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Figure } from "./figure";

const props = {
  src: "/devlog-assets/a-post/flow.svg",
  alt: "A repository going into a sandbox",
  width: 1200,
  height: 480,
};

describe("Figure", () => {
  it("shows the image with its caption", () => {
    render(<Figure {...props} caption="Where your code goes." />);

    expect(screen.getByRole("img", { name: props.alt })).toHaveAttribute(
      "src",
      props.src,
    );
    expect(screen.getByText("Where your code goes.").tagName).toBe(
      "FIGCAPTION",
    );
  });

  it("shows the dark version only in dark mode", () => {
    render(<Figure {...props} darkSrc="/devlog-assets/a-post/flow-dark.svg" />);

    const [light, dark] = screen.getAllByRole("img", { name: props.alt });
    expect(light).toHaveClass("dark:hidden");
    expect(dark).toHaveClass("hidden", "dark:block");
    expect(dark).toHaveAttribute("src", "/devlog-assets/a-post/flow-dark.svg");
  });
});
