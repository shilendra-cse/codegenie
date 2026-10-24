import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecentTasks } from "./recent-tasks";

describe("RecentTasks", () => {
  it("lists tasks with their project and status, each linking to it", () => {
    render(
      <RecentTasks
        tasks={[
          {
            id: "t1",
            href: "/tasks/t1",
            title: "Paginate the orders API",
            projectName: "buyerbook",
            label: "pr_open",
            prNumber: 41,
          },
        ]}
      />,
    );
    const row = screen.getByRole("link", { name: /Paginate the orders API/ });
    expect(row).toHaveAttribute("href", "/tasks/t1");
    expect(row).toHaveTextContent("buyerbook");
    expect(row).toHaveTextContent("PR #41 open");
  });

  it("is hidden without tasks", () => {
    const { container } = render(<RecentTasks tasks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
