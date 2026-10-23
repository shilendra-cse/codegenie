import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GitHubMark } from "./github-mark";

describe("GitHubMark", () => {
  it("is decorative next to text, and named when on its own", () => {
    const { container } = render(<GitHubMark />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    render(<GitHubMark label="GitHub" />);
    expect(screen.getByRole("img", { name: "GitHub" })).toBeInTheDocument();
  });
});
