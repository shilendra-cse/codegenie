import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskStatusIcon } from "./task-status-icon";

describe("TaskStatusIcon", () => {
  it("spins while a task is queued or working", () => {
    const { container } = render(<TaskStatusIcon status="working" />);
    expect(container.querySelector("svg")).toHaveClass("text-primary-text");
  });

  it.each([
    ["needs_you", "text-primary-text"],
    ["pr_open", "text-ok"],
    ["pr_draft", "text-warn"],
    ["merged", "text-merged"],
    ["failed", "text-err"],
    ["cancelled", "text-faint"],
  ] as const)("colours %s", (status, className) => {
    const { container } = render(<TaskStatusIcon status={status} />);
    expect(container.querySelector("svg")).toHaveClass(className);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
