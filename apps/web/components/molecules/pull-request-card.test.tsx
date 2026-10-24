import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PullRequestCard } from "./pull-request-card";

describe("PullRequestCard", () => {
  it("shows the pull request, where it stands and a link to it", () => {
    render(
      <PullRequestCard
        number={41}
        url="https://github.com/x/y/pull/41"
        title="Paginate the orders API"
        line="Ready for review · into main"
        tone="ok"
      />,
    );

    expect(screen.getByText("Paginate the orders API")).toHaveTextContent(
      "Paginate the orders API #41",
    );
    expect(
      screen.getByText("Ready for review · into main"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open PR #41 on GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/x/y/pull/41");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("Open on GitHub");
  });
});
