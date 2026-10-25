import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPills } from "./filter-pills";

const pills = [
  { key: "all", label: "All", count: 8 },
  { key: "running", label: "Running", count: 2 },
  { key: "done", label: "Done" },
];

describe("FilterPills", () => {
  it("marks the selected filter and shows the counts it has", () => {
    render(
      <FilterPills
        label="Filter"
        pills={pills}
        selected="running"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Running 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "All 8" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Done" })).toBeInTheDocument();
  });

  it("picks a filter", () => {
    const onSelect = vi.fn();
    render(
      <FilterPills
        label="Filter"
        pills={pills}
        selected="all"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Done/ }));

    expect(onSelect).toHaveBeenCalledWith("done");
  });
});
