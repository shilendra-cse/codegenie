import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GettingStartedCard } from "./getting-started-card";

describe("GettingStartedCard", () => {
  it("shows your progress and the next step, and leads back to the checklist", () => {
    render(<GettingStartedCard done={2} next="set-up" projectName="dodesk" />);

    const card = screen.getByRole("link");
    expect(card).toHaveAttribute("href", "/welcome");
    expect(card).toHaveTextContent("Getting started");
    expect(card).toHaveTextContent("2 of 4");
    expect(card).toHaveTextContent("Next: Set up dodesk");
  });

  it("names the next step without a project", () => {
    render(<GettingStartedCard done={1} next="add-repo" />);
    expect(screen.getByRole("link")).toHaveTextContent(
      "Next: Add a repository",
    );
  });
});
