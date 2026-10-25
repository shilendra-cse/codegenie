import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboxList, type InboxRow } from "./inbox-list";

const row = (id: string, title: string): InboxRow => ({
  id,
  href: `/tasks/${id}`,
  status: "working",
  title,
  detail: "Working",
  project: "dodesk",
  badge: <span>Working</span>,
  durationAndCost: "4m 12s · $0.08",
  when: "just now",
});

const groups = [
  { label: "Today", rows: [row("t1", "Add a /health endpoint")] },
  { label: "Yesterday", rows: [row("t2", "Fix currency rounding")] },
];

describe("InboxList", () => {
  it("shows the rows under their day, in order", () => {
    render(
      <InboxList
        groups={groups}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    const sections = screen.getAllByRole("region");
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual([
      "Today",
      "Yesterday",
    ]);
    expect(within(sections[1]!).getByRole("link")).toHaveTextContent(
      "Fix currency rounding",
    );
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("loads more when there's another page, and is busy meanwhile", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <InboxList
        groups={groups}
        hasMore
        loadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();

    rerender(
      <InboxList groups={groups} hasMore loadingMore onLoadMore={onLoadMore} />,
    );
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
  });
});
