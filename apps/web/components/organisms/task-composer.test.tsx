import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskComposer, type TaskComposerProps } from "./task-composer";

function renderComposer(overrides: Partial<TaskComposerProps> = {}) {
  const props: TaskComposerProps = {
    text: "Add a /health endpoint",
    onTextChange: vi.fn(),
    projects: [
      { id: "p1", name: "dodesk", branch: "main", health: "ok", blocked: null },
    ],
    projectId: "p1",
    onProjectChange: vi.fn(),
    branch: "main",
    onBranchChange: vi.fn(),
    branchError: null,
    canStart: true,
    starting: false,
    error: null,
    onStart: vi.fn(),
    ...overrides,
  };
  render(<TaskComposer {...props} />);
  return props;
}

describe("TaskComposer", () => {
  it("starts with the button", () => {
    const { onStart } = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it.each([
    ["⌘↵", { metaKey: true }],
    ["Ctrl↵", { ctrlKey: true }],
  ])("starts with %s", (_keys, modifier) => {
    const { onStart } = renderComposer();
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      ...modifier,
    });
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("doesn't start until it can, or while starting", () => {
    const { onStart } = renderComposer({ canStart: false });
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      metaKey: true,
    });
    expect(onStart).not.toHaveBeenCalled();
  });

  it("passes on what you type", () => {
    const { onTextChange } = renderComposer({ text: "" });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Fix the login" },
    });
    expect(onTextChange).toHaveBeenCalledWith("Fix the login");
  });

  it("shows why starting failed, with the fix", () => {
    renderComposer({
      error: {
        message: "This project's setup needs attention.",
        fix: { label: "Re-run setup", href: "/projects/p1/environment" },
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This project's setup needs attention.",
    );
    expect(screen.getByRole("link", { name: "Re-run setup" })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
  });

  it("shows the branch only once a project is picked", () => {
    renderComposer({ projectId: null });
    expect(screen.queryByLabelText("Base branch")).not.toBeInTheDocument();
  });
});
