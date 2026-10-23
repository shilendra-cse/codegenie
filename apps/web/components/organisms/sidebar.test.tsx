import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("shows New task as not ready yet and no projects", () => {
    render(<Sidebar pathname="/welcome" account={null} />);

    const newTask = screen.getByRole("button", { name: "New task" });
    expect(newTask).toBeDisabled();
    expect(newTask).toHaveClass("bg-card", "disabled:text-faint");
    expect(newTask).not.toHaveClass("bg-primary");
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
