import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("shows New task as not ready yet and no projects", () => {
    render(<Sidebar pathname="/welcome" account={null} />);

    expect(screen.getByRole("button", { name: "New task" })).toBeDisabled();
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inbox" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the link for the current page", () => {
    render(<Sidebar pathname="/inbox" account={null} />);

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
