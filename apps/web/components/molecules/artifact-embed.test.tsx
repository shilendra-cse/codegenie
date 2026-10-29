import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtifactEmbed } from "./artifact-embed";

const props = {
  src: "/devlog-assets/a-post/run.html",
  title: "Run lifecycle",
  height: 520,
  caption: "Click a stage.",
};

describe("ArtifactEmbed", () => {
  it("runs the artifact sandboxed, never with this site's origin", () => {
    render(<ArtifactEmbed {...props} theme="dark" />);

    const frame = screen.getByTitle("Run lifecycle");
    const sandbox = frame.getAttribute("sandbox")?.split(" ");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("passes the theme and uses the given height", () => {
    render(<ArtifactEmbed {...props} theme="light" />);

    const frame = screen.getByTitle("Run lifecycle");
    expect(frame).toHaveAttribute(
      "src",
      "/devlog-assets/a-post/run.html?theme=light",
    );
    expect(frame).toHaveStyle({ height: "520px" });
    expect(screen.getByText("Click a stage.").tagName).toBe("FIGCAPTION");
  });

  it("opens full screen in a new tab", () => {
    render(<ArtifactEmbed {...props} theme="dark" />);

    const link = screen.getByRole("link", { name: /Open full screen/ });
    expect(link).toHaveAttribute(
      "href",
      "/devlog-assets/a-post/run.html?theme=dark",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("waits for the theme before loading, keeping its space", () => {
    const { container } = render(
      <ArtifactEmbed {...props} theme={undefined} />,
    );

    expect(screen.queryByTitle("Run lifecycle")).toBeNull();
    expect(screen.queryByRole("link", { name: /Open full screen/ })).toBeNull();
    expect(container.querySelector('div[aria-hidden="true"]')).toHaveStyle({
      height: "520px",
    });
  });
});
