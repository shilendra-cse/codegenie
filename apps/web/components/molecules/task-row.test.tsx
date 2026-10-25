import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskRow } from "./task-row";

describe("TaskRow", () => {
  it("links the whole row to the task and shows what it's doing", () => {
    render(
      <TaskRow
        href="/tasks/t1"
        status="pr_open"
        title="Paginate the orders API"
        detail="Checks passing · 4 files changed"
        project="buyerbook"
        badge={<span>PR #41 open</span>}
        durationAndCost="7m 12s · $0.21"
        when="25 minutes ago"
      />,
    );

    const row = screen.getByRole("link");
    expect(row).toHaveAttribute("href", "/tasks/t1");
    for (const text of [
      "Paginate the orders API",
      "Checks passing · 4 files changed",
      "buyerbook",
      "PR #41 open",
      "7m 12s · $0.21",
      "25 minutes ago",
    ]) {
      expect(row).toHaveTextContent(text);
    }
  });
});
