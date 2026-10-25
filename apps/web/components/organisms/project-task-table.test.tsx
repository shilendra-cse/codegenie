import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ProjectTaskRow, ProjectTaskTable } from "./project-task-table";

const row = (
  id: string,
  title: string,
  pullRequest: ProjectTaskRow["pullRequest"],
): ProjectTaskRow => ({
  id,
  href: `/tasks/${id}`,
  title,
  status: <span>PR #36 open</span>,
  pullRequest,
  runs: 2,
  duration: "8m 51s",
  cost: "$0.19",
  updated: "2 days ago",
});

const show = (rows: ProjectTaskRow[], hasMore = false, onLoadMore = vi.fn()) =>
  render(
    <ProjectTaskTable
      rows={rows}
      hasMore={hasMore}
      loadingMore={false}
      onLoadMore={onLoadMore}
    />,
  );

describe("ProjectTaskTable", () => {
  it("shows each task's status, pull request, runs, duration, cost and when", () => {
    show([row("t1", "Show order totals", { number: 36, url: "https://x/36" })]);

    const cells = within(screen.getAllByRole("row")[1]!)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells).toEqual([
      "Show order totals",
      "PR #36 open",
      "#36",
      "2",
      "8m 51s",
      "$0.19",
      "2 days ago",
    ]);
  });

  it("opens the task from its title and the pull request on GitHub", () => {
    show([row("t1", "Show order totals", { number: 36, url: "https://x/36" })]);

    expect(
      screen.getByRole("link", { name: "Show order totals" }),
    ).toHaveAttribute("href", "/tasks/t1");
    expect(screen.getByRole("link", { name: "#36" })).toHaveAttribute(
      "href",
      "https://x/36",
    );
  });

  it("shows a dash when there's no pull request", () => {
    show([row("t1", "Upgrade ESLint", null)]);

    expect(screen.queryByRole("link", { name: /#/ })).toBeNull();
    expect(within(screen.getAllByRole("row")[1]!).getByText("—")).toBeVisible();
  });

  it("loads more when there are more", () => {
    const onLoadMore = vi.fn();
    show([row("t1", "Upgrade ESLint", null)], true, onLoadMore);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("hides Load more on the last page", () => {
    show([row("t1", "Upgrade ESLint", null)]);

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
