import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskStatusBadge } from "./task-status-badge";

describe("TaskStatusBadge", () => {
  it.each([
    ["queued", null, "Queued"],
    ["working", null, "Working"],
    ["pr_open", 41, "PR #41 open"],
    ["pr_draft", 41, "Draft PR #41"],
    ["merged", 41, "PR #41 merged"],
    ["closed", 41, "PR #41 closed"],
    ["no_changes", null, "No changes"],
    ["failed", null, "Failed"],
    ["cancelled", null, "Cancelled"],
  ] as const)("shows %s", (label, prNumber, text) => {
    render(<TaskStatusBadge label={label} prNumber={prNumber} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("marks a closed pull request like GitHub does", () => {
    render(<TaskStatusBadge label="closed" prNumber={41} />);
    expect(screen.getByText("PR #41 closed")).toHaveClass("text-err");
  });
});
